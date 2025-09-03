/**
 * Firebase Cloud Functions for Glass Project
 * 
 * This module provides authentication and user management functions
 * for the Glass web dashboard and desktop application integration.
 */

const {onRequest, onCall} = require("firebase-functions/v2/https");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});

// Initialize Firebase Admin SDK
admin.initializeApp();

// Helper function for structured error logging
const logError = (functionName, error, context = {}) => {
  logger.error(`${functionName} error:`, {
    error: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });
};

// Helper function for structured info logging
const logInfo = (functionName, message, data = {}) => {
  logger.info(`${functionName}: ${message}`, {
    data,
    timestamp: new Date().toISOString()
  });
};

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/**
 * @name pickleGlassAuthCallback
 * @description
 * Validate Firebase ID token and return custom token for desktop app authentication.
 * This function enables the desktop app to authenticate with Firebase using tokens
 * generated from the web dashboard.
 *
 * @param {object} request - HTTPS request object. Contains { token: "..." }.
 * @param {object} response - HTTPS response object.
 */
const authCallbackHandler = (request, response) => {
  cors(request, response, async () => {
    const functionName = "pickleGlassAuthCallback";
    
    try {
      logInfo(functionName, "Function triggered", {
        method: request.method,
        hasBody: !!request.body,
        userAgent: request.get('User-Agent')
      });

      // Validate HTTP method
      if (request.method !== "POST") {
        logError(functionName, new Error("Invalid HTTP method"), { method: request.method });
        response.status(405).json({
          success: false,
          error: "Method Not Allowed. Use POST.",
        });
        return;
      }

      // Validate request body and token
      if (!request.body || typeof request.body !== 'object') {
        logError(functionName, new Error("Invalid request body"));
        response.status(400).json({
          success: false,
          error: "Invalid request body.",
        });
        return;
      }

      if (!request.body.token || typeof request.body.token !== 'string') {
        logError(functionName, new Error("Missing or invalid token"));
        response.status(400).json({
          success: false,
          error: "ID token is required and must be a string.",
        });
        return;
      }

      const idToken = request.body.token.trim();
      
      if (idToken.length === 0) {
        logError(functionName, new Error("Empty token"));
        response.status(400).json({
          success: false,
          error: "ID token cannot be empty.",
        });
        return;
      }

      // Verify the ID token
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (tokenError) {
        logError(functionName, tokenError, { tokenLength: idToken.length });
        response.status(401).json({
          success: false,
          error: "Invalid or expired ID token.",
          details: process.env.NODE_ENV === 'development' ? tokenError.message : undefined
        });
        return;
      }

      const uid = decodedToken.uid;
      logInfo(functionName, "Token verified successfully", { uid });

      // Create custom token for desktop app
      let customToken;
      try {
        customToken = await admin.auth().createCustomToken(uid);
      } catch (customTokenError) {
        logError(functionName, customTokenError, { uid });
        response.status(500).json({
          success: false,
          error: "Failed to create custom token.",
        });
        return;
      }

      // Prepare user information
      const userInfo = {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
        name: decodedToken.name || decodedToken.display_name || null,
        picture: decodedToken.picture || null,
        emailVerified: decodedToken.email_verified || false
      };

      logInfo(functionName, "Authentication successful", { 
        uid: userInfo.uid,
        email: userInfo.email,
        emailVerified: userInfo.emailVerified
      });

      response.status(200).json({
        success: true,
        message: "Authentication successful.",
        user: userInfo,
        customToken,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logError(functionName, error, {
        hasBody: !!request.body,
        bodyKeys: request.body ? Object.keys(request.body) : []
      });
      
      response.status(500).json({
        success: false,
        error: "Internal server error during authentication.",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
};

exports.pickleGlassAuthCallback = onRequest(
    {region: "us-west1"},
    authCallbackHandler,
);
