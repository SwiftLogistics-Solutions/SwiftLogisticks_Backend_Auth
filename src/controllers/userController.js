import admin from "../config/firebase.js";
import { Customer, Driver } from "../modules/userModule.js";
import { findCoordinatesByAddress } from "../utils/locationUtils.js";

export const createUser = async (req, res) => {
  const { name, email, password, confirmPassword, phone, address, role, license_number, vehicle_info } = req.body;

  try {
    // Validate input
    if (!name || !email || !password || !confirmPassword || !phone || !address || !role) {
      return res.status(400).json({ message: "All required fields must be provided (name, email, password, confirmPassword, phone, address, role)" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (!["customer", "driver"].includes(role)) {
      return res.status(400).json({ message: "Role must be either 'customer' or 'driver'" });
    }

    // Additional validation for drivers
    if (role === "driver" && !license_number) {
      return res.status(400).json({ message: "License number is required for drivers" });
    }

    // Find coordinates based on address
    const locationData = findCoordinatesByAddress(address);
    
    let current_location;
    if (locationData) {
      // District found in address - use mapped coordinates
      current_location = {
        address: address,
        latitude: locationData.latitude,
        longitude: locationData.longitude
      };
    } else {
      // No district found - require manual coordinates
      return res.status(400).json({ 
        message: "Could not determine location from address. Please ensure your address includes a valid Sri Lankan district/city.",
        suggestion: "Include districts like Colombo, Kandy, Galle, etc. in your address"
      });
    }

    // Check if user already exists in MongoDB
    const existingCustomer = await Customer.findOne({ email });
    const existingDriver = await Driver.findOne({ email });
    
    if (existingCustomer || existingDriver) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // Create user in Firebase
    const userResponse = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name,
    });

    // Set custom claims for additional user data
    await admin.auth().setCustomUserClaims(userResponse.uid, {
      role: role,
    });

    // Generate unique IDs
    const generateUniqueId = (role) => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      const prefix = role === "customer" ? "C" : "D";
      return `${prefix}${timestamp}${random}`.toUpperCase();
    };

    // Prepare common user data
    const commonUserData = {
      firebaseUID: userResponse.uid,
      name: name,
      email: email,
      phone: phone,
      current_location: current_location,
      role: role,
    };

    let savedUser;

    // Create user in appropriate MongoDB collection based on role
    if (role === "customer") {
      const customerData = {
        ...commonUserData,
        customer_id: generateUniqueId("customer"),
      };
      
      const customer = new Customer(customerData);
      savedUser = await customer.save();
    } else if (role === "driver") {
      const driverData = {
        ...commonUserData,
        driver_id: generateUniqueId("driver"),
        license_number: license_number,
        vehicle_info: vehicle_info || {}, // Optional vehicle info
        assigned_orders: [],
        completed_orders: [],
      };
      
      const driver = new Driver(driverData);
      savedUser = await driver.save();
    }

    res.status(201).json({ 
      message: "User created successfully", 
      user: {
        firebaseUID: userResponse.uid,
        email: userResponse.email,
        displayName: userResponse.displayName,
        role: role,
        mongoData: savedUser
      },
      locationInfo: {
        detectedDistrict: locationData.district,
        matchType: locationData.matchType,
        coordinates: {
          latitude: locationData.latitude,
          longitude: locationData.longitude
        },
        ...(locationData.matchedAlias && { matchedAlias: locationData.matchedAlias })
      }
    });
  } catch (error) {
    console.error("Error creating user:", error);
    
    // Clean up Firebase user if MongoDB save fails
    if (error.code === 11000) {
      return res.status(400).json({ message: "User already exists" });
    }
    
    res.status(400).json({ 
      message: "Error creating user", 
      error: error.message 
    });
  }
}

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Use Firebase Auth REST API to verify email and password
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password,
        returnSecureToken: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Firebase Auth failed - invalid credentials
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Get user details from Firebase Admin SDK
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Get user details from MongoDB based on role
    let mongoUser = null;
    const role = userRecord.customClaims?.role;
    
    if (role === "customer") {
      mongoUser = await Customer.findOne({ firebaseUID: userRecord.uid });
    } else if (role === "driver") {
      mongoUser = await Driver.findOne({ firebaseUID: userRecord.uid });
    }
    
    res.status(200).json({ 
      message: "Login successful", 
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: role,
        customClaims: userRecord.customClaims,
        profile: mongoUser
      },
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export const logoutUser = async (req, res) => {
  try {
    const { uid, idToken } = req.body;

    if (uid) {
      // Step 1: Revoke all refresh tokens for the user
      // This prevents the user from getting new ID tokens
      await admin.auth().revokeRefreshTokens(uid);
      
      // Step 2: Verify the current ID token and get user info
      let userEmail = "Unknown";
      let tokenValid = false;
      
      if (idToken) {
        try {
          // Verify the token with checkRevoked: true to ensure it's not from a revoked session
          const decodedToken = await admin.auth().verifyIdToken(idToken, true);
          userEmail = decodedToken.email;
          tokenValid = true;
          console.log(`User ${userEmail} logged out successfully`);
        } catch (tokenError) {
          console.log("Token verification failed during logout:", tokenError.message);
          // Token might be expired or revoked, which is expected after revokeRefreshTokens
        }
      }

      res.status(200).json({ 
        message: "Logout successful", 
        details: {
          serverSideLogout: "✅ Refresh tokens revoked",
          tokenStatus: tokenValid ? "Valid at logout time" : "Invalid/Expired"
        },
        timestamp: new Date().toISOString()
      });
    } else {
      // If no UID provided, guide client on what to do
      res.status(200).json({ 
        message: "Client-side logout guidance",
        warning: "⚠️ Server-side token revocation not performed (no UID provided)",
        instructions: [
          "Clear all tokens from client storage",
          "Call firebase.auth().signOut() on client",
          "Clear any cached user data",
          "Redirect to login page"
        ],
        note: "For complete security, provide UID for server-side token revocation",
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ 
      message: "Error during logout", 
      error: error.message 
    });
  }
}

// Get available districts endpoint
export const getDistricts = (req, res) => {
  try {
    import('../utils/locationUtils.js').then(({ getAllDistricts, getDistrictInfo }) => {
      const districts = getAllDistricts();
      const districtDetails = {};
      
      districts.forEach(district => {
        districtDetails[district] = getDistrictInfo(district);
      });

      res.status(200).json({
        message: "Available districts for location mapping",
        totalDistricts: districts.length,
        districts: districtDetails,
        usage: "Include any of these district names or aliases in your address during signup for automatic coordinate mapping"
      });
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching districts",
      error: error.message
    });
  }
}
