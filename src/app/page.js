'use client';
import React, { useState, useEffect, useRef } from 'react';

// Import components
import ControlPanel from './components/ControlPanel';
import StatusInformation from './components/StatusInfo';
import CameraView from './components/CameraView';

// Import utilities
import { initializeCamera, captureFrame, cleanupCamera } from './utils/CameraUtils';
import { sendFrameToAPI } from './utils/apiService';
import { useDetection } from './hooks/UseDetection';

// Constants for attempt limits and timeouts
const MAX_ATTEMPTS = 3;
const DETECTION_TIMEOUT = 40000; // 40 seconds

const CardDetectionApp = () => {
  // Authentication state
  const [authData, setAuthData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Existing state management
  const [currentPhase, setCurrentPhase] = useState('idle');
  const [detectionActive, setDetectionActive] = useState(false);
  const [finalOcrResults, setFinalOcrResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionId, setSessionId] = useState('');
  
  // Attempt tracking state - FIXED: Better state management
  const [attemptCount, setAttemptCount] = useState(0);
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);
  const [currentOperation, setCurrentOperation] = useState(''); // 'validation', 'front', 'back'
  
  const [validationState, setValidationState] = useState({
    physicalCard: false,
    movementState: null,
    movementMessage: '',
    validationComplete: false
  });
  
  // Updated frontScanState to include bankLogoDetected
  const [frontScanState, setFrontScanState] = useState({
    framesBuffered: 0,
    chipDetected: false,
    bankLogoDetected: false,
    canProceedToBack: false
  });
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const capturedFrames = useRef([]);
  const countdownIntervalRef = useRef(null);
  const validationIntervalRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const detectionTimeoutRef = useRef(null);

  // Check for authentication data on component mount
  useEffect(() => {
    const checkAuthData = async () => {
      console.log('🔍 Checking for authentication data...');
      
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session');
      const merchantId = urlParams.get('merchant_id');
      const authToken = urlParams.get('auth_token');
      const source = urlParams.get('source');
      const demo = urlParams.get('demo');
      
      // Method 1: Session-based auth (most secure)
      if (sessionId) {
        console.log('🔐 Found session ID, retrieving auth data securely...');
        try {
          const response = await fetch(`/securityscan/api/webview-entry?session=${sessionId}`);
          if (response.ok) {
            const sessionData = await response.json();
            console.log('✅ Session auth data retrieved:', {
              merchantId: sessionData.merchantId,
              authTokenLength: sessionData.authToken.length,
              authTokenPreview: sessionData.authToken.substring(0, 20) + '...'
            });
            
            const authObj = {
              merchantId: sessionData.merchantId,
              authToken: sessionData.authToken,
              timestamp: Date.now(),
              source: 'secure_session'
            };
            
            setAuthData(authObj);
            window.__WEBVIEW_AUTH__ = authObj;
            setAuthLoading(false);
            
            // Clean URL (remove session ID)
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            return;
          } else {
            console.error('❌ Session retrieval failed:', response.status);
          }
        } catch (error) {
          console.error('❌ Session fetch error:', error);
        }
      }
      
      // Method 2: URL parameters (fallback, less secure)
      if (merchantId && authToken && authToken.length > 10) {
        console.log('✅ Auth data found from URL params');
        console.log('🔑 Credentials valid:', { 
          merchantId, 
          authTokenLength: authToken.length,
          authTokenPreview: authToken.substring(0, 20) + '...',
          source 
        });
        
        const authObj = { 
          merchantId, 
          authToken, 
          timestamp: Date.now(),
          source: source || 'url_params'
        };
        
        setAuthData(authObj);
        window.__WEBVIEW_AUTH__ = authObj;
        setAuthLoading(false);
        
        // Clean URL for security (remove tokens from address bar)
        if (!demo) {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
        return;
      }
      
      // Method 3: Demo mode (development only)
      if (process.env.NODE_ENV === 'development' || demo === 'true') {
        console.log('🧪 Using development/demo auth data');
        const demoAuthObj = {
          merchantId: 'MERCHANT_12345',
          authToken: 'demo_jwt_token_1234567890123456789012345678901234567890', // Longer token
          timestamp: Date.now(),
          source: 'development_demo'
        };
        
        setAuthData(demoAuthObj);
        window.__WEBVIEW_AUTH__ = demoAuthObj;
        setAuthLoading(false);
        return;
      }
      
      // No auth data found
      console.error('❌ No authentication data found');
      console.error('Available URL params:', Array.from(urlParams.entries()));
      setAuthError('No authentication data received from Android app');
      setAuthLoading(false);
    };
    
    checkAuthData();
  }, []);

  // Helper function to clear detection timeout
  const clearDetectionTimeout = () => {
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
      detectionTimeoutRef.current = null;
    }
  };

  // Helper function to handle detection timeout
  const startDetectionTimeout = (operation) => {
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }
    
    detectionTimeoutRef.current = setTimeout(() => {
      if (!stopRequestedRef.current && (detectionActive || isProcessing)) {
        handleDetectionFailure(`${operation} detection timeout. No detection occurred within 40 seconds.`, operation);
      }
    }, DETECTION_TIMEOUT);
  };

  // Initialize camera after auth is ready
  useEffect(() => {
    if (authData && !authLoading) {
      initializeCamera(videoRef)
        .then(() => {
          console.log('📷 Camera initialized successfully');
        })
        .catch((error) => {
          console.error('❌ Camera initialization failed:', error);
          setErrorMessage('Camera access failed. Please allow camera permissions.');
        });
    }
    
    return () => {
      cleanupCamera(videoRef);
      clearDetectionTimeout();

      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      if (validationIntervalRef.current) {
        clearInterval(validationIntervalRef.current);
      }
    };
  }, [authData, authLoading]);

  // Custom hook for detection logic
  const { captureAndSendFramesFront, captureAndSendFrames, captureIntervalRef } = useDetection(
    videoRef,
    canvasRef,
    sessionId,
    setSessionId,
    setIsProcessing,
    setCurrentPhase,
    setErrorMessage,
    setFrontScanState,
    stopRequestedRef
  );

  // Test API Connection function
  const testAPIConnection = async () => {
    if (!authData) return;
    
    try {
      const { merchantId, authToken } = authData;
      
      // Skip API test for demo mode to avoid 422 errors
      if (authData.source === 'development_demo') {
        console.log('🧪 Skipping API test for demo mode');
        return;
      }
      
      const testUrl = `https://cardapp.hopto.org/detect/${merchantId}/${authToken}`;
      
      const formData = new FormData();
      formData.append('test', 'connection');
      
      const response = await fetch(testUrl, {
        method: 'POST',
        body: formData
      });
      
      console.log('✅ API Connection Test:', response.status);
    } catch (error) {
      console.error('❌ API Connection Test Failed:', error);
    }
  };

  // Call API test when auth data is ready
  useEffect(() => {
    if (authData) {
      testAPIConnection();
    }
  }, [authData]);

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Initializing Security Scanner...</h3>
          <p className="text-gray-600 text-sm">
            Loading authentication data from Android app
          </p>
        </div>
      </div>
    );
  }

  // Show error if no authentication data
  if (authError || !authData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-red-600 mb-2">Authentication Required</h3>
          <p className="text-gray-600 text-sm mb-4">
            This page requires authentication data from the Android app.
          </p>
          
          {/* Development links */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-50 p-3 rounded mb-4 text-left">
              <p className="text-xs font-semibold mb-2">Development Testing:</p>
              <div className="space-y-1">
                <a 
                  href="?demo=true" 
                  className="block text-blue-600 text-xs hover:underline"
                >
                  🧪 Use Demo Mode
                </a>
                <a 
                  href="?merchant_id=MERCHANT_12345&auth_token=test_jwt_token_1234567890123456" 
                  className="block text-blue-600 text-xs hover:underline"
                >
                  🔧 Test with URL Parameters
                </a>
              </div>
            </div>
          )}
          
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // FIXED: Helper function to handle detection failures with attempt tracking
  const handleDetectionFailure = (message, operation) => {
    console.log(`🚨 Detection failure: ${message} for operation: ${operation}`);
    
    clearDetectionTimeout();
    stopRequestedRef.current = true;
    
    // Clear all intervals
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    
    if (validationIntervalRef.current) {
      clearInterval(validationIntervalRef.current);
      validationIntervalRef.current = null;
    }
    
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    setDetectionActive(false);
    setIsProcessing(false);
    setCountdown(0);
    
    // FIXED: Increment attempt count properly
    const newAttemptCount = attemptCount + 1;
    console.log(`📊 Attempt count: ${attemptCount} -> ${newAttemptCount} (Max: ${MAX_ATTEMPTS})`);
    
    setAttemptCount(newAttemptCount);
    setCurrentOperation(operation);
    
    // FIXED: Check max attempts correctly
    if (newAttemptCount >= MAX_ATTEMPTS) {
      console.log('🚫 Maximum attempts reached!');
      setMaxAttemptsReached(true);
      setErrorMessage(`Maximum attempts reached (${MAX_ATTEMPTS}). Please contact support for assistance.`);
      setCurrentPhase('max-attempts-reached');
    } else {
      console.log(`⚠️ Setting error phase. Attempts remaining: ${MAX_ATTEMPTS - newAttemptCount}`);
      setErrorMessage(`${message} (Attempt ${newAttemptCount}/${MAX_ATTEMPTS})`);
      setCurrentPhase('error');
    }
  };

  // Stop function to halt all active processes
  const stopDetection = () => {
    console.log('🛑 Stopping detection...');
    stopRequestedRef.current = true;
    clearDetectionTimeout();
    
    // Clear all intervals
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    
    if (validationIntervalRef.current) {
      clearInterval(validationIntervalRef.current);
      validationIntervalRef.current = null;
    }
    
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    // Reset states
    setDetectionActive(false);
    setIsProcessing(false);
    setCountdown(0);
    
    // Return to appropriate phase based on current state
    if (currentPhase === 'validation') {
      setCurrentPhase('idle');
      setValidationState({
        physicalCard: false,
        movementState: null,
        movementMessage: '',
        validationComplete: false
      });
    } else if (currentPhase === 'front-countdown' || currentPhase === 'front') {
      setCurrentPhase('ready-for-front');
      setFrontScanState({
        framesBuffered: 0,
        chipDetected: false,
        bankLogoDetected: false,
        canProceedToBack: false
      });
    } else if (currentPhase === 'back-countdown' || currentPhase === 'back') {
      setCurrentPhase('ready-for-back');
    }
  };

  // Countdown function
  const startCountdown = (onComplete) => {
    setCountdown(3);
    stopRequestedRef.current = false;
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          if (!stopRequestedRef.current) {
            onComplete();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // FIXED: Card validation process - don't reset attempt count on success in wrong place
  const startCardValidation = async () => {
    if (maxAttemptsReached) {
      console.log('🚫 Cannot start validation - max attempts reached');
      return;
    }
    
    console.log('🔍 Starting card validation...');
    setCurrentPhase('validation');
    setErrorMessage('');
    stopRequestedRef.current = false;
    setValidationState({
      physicalCard: false,
      movementState: null,
      movementMessage: 'Starting validation...',
      validationComplete: false
    });

    const currentSessionId = `session_${Date.now()}`;
    setSessionId(currentSessionId);

    let frameNumber = 0;
    let validationComplete = false;
    const maxValidationTime = 27000;
    const startTime = Date.now();

    // Start detection timeout
    startDetectionTimeout('Validation');

    if (!videoRef.current || videoRef.current.readyState < 2) {
      handleDetectionFailure('Video not ready for capture', 'validation');
      return;
    }

    const processValidationFrame = async () => {
      try {
        if (stopRequestedRef.current || validationComplete || (Date.now() - startTime) > maxValidationTime) {
          return;
        }

        const frame = await captureFrame(videoRef, canvasRef);
        if (!frame || frame.size === 0) {
          return;
        }

        frameNumber++;
        setIsProcessing(true);

        const apiResponse = await sendFrameToAPI(frame, 'validation', currentSessionId, frameNumber);
        
        if (stopRequestedRef.current) {
          setIsProcessing(false);
          return;
        }
        
        // Check for validation failures in both message_state AND movement_state
        if (apiResponse.message_state === "VALIDATION_FAILED" || 
            apiResponse.movement_state === "VALIDATION_FAILED") {
          validationComplete = true;
          clearDetectionTimeout();
          
          if (validationIntervalRef.current) {
            clearInterval(validationIntervalRef.current);
          }
          
          setIsProcessing(false);
          
          // Use appropriate error message based on which field contains the failure
          const errorMsg = apiResponse.message || 
                          (apiResponse.movement_state === "VALIDATION_FAILED" ? 
                           'Card validation failed. Please ensure you have a physical card and try again.' : 
                           'Validation failed. Please try again.');
          
          handleDetectionFailure(errorMsg, 'validation');
          return;
        }

        // Check for validation success in both fields
        if (apiResponse.message_state === "VALIDATION_PASSED" || 
            apiResponse.movement_state === "VALIDATION_PASSED") {
          validationComplete = true;
          clearDetectionTimeout();
          
          if (validationIntervalRef.current) {
            clearInterval(validationIntervalRef.current);
          }
          
          setIsProcessing(false);
          
          console.log('✅ Validation passed! Resetting attempt count.');
          // FIXED: Reset attempts only on successful validation
          setAttemptCount(0);
          setMaxAttemptsReached(false);
          setCurrentOperation('');
          
          setTimeout(() => {
            if (!stopRequestedRef.current) {
              setCurrentPhase('ready-for-front');
            }
          }, 2000);
          return;
        }
        
        // Update validation state - show failure message immediately if movement_state indicates failure
        const newValidationState = {
          physicalCard: apiResponse.physical_card || false,
          movementState: apiResponse.movement_state || null,
          movementMessage: apiResponse.movement_message || 
                          (apiResponse.movement_state === "VALIDATION_FAILED" ? 
                           'Validation Failed' : ''),
          validationComplete: apiResponse.physical_card || false
        };

        setValidationState(newValidationState);
        setIsProcessing(false);

        // Keep the existing logic for backward compatibility
        if (newValidationState.validationComplete && !stopRequestedRef.current) {
          validationComplete = true;
          clearDetectionTimeout();
          
          if (validationIntervalRef.current) {
            clearInterval(validationIntervalRef.current);
          }
          
          console.log('✅ Legacy validation complete! Resetting attempt count.');
          // FIXED: Reset attempts only on successful validation
          setAttemptCount(0);
          setMaxAttemptsReached(false);
          setCurrentOperation('');
          
          setTimeout(() => {
            if (!stopRequestedRef.current) {
              setCurrentPhase('ready-for-front');
            }
          }, 2000);
        }

      } catch (error) {
        console.error('Validation frame processing error:', error);
        setIsProcessing(false);
      }
    };

    processValidationFrame();
    validationIntervalRef.current = setInterval(processValidationFrame, 1500);

    setTimeout(() => {
      if (!validationComplete && !stopRequestedRef.current) {
        if (validationIntervalRef.current) {
          clearInterval(validationIntervalRef.current);
        }
        handleDetectionFailure('Our intelligence system requires you to try again since the card scan failed', 'validation');
      }
    }, maxValidationTime);
  };

  const startFrontSideDetection = async () => {
    if (maxAttemptsReached) {
      console.log('🚫 Cannot start front scan - max attempts reached');
      return;
    }
    
    console.log('🔍 Starting front side detection...');
    setFrontScanState({
      framesBuffered: 0,
      chipDetected: false,
      bankLogoDetected: false,
      canProceedToBack: false
    });

    setCurrentPhase('front-countdown');
    setErrorMessage('');

    startCountdown(async () => {
      if (stopRequestedRef.current) return;
      
      setCurrentPhase('front');
      setDetectionActive(true);
      stopRequestedRef.current = false;

      // Start detection timeout
      startDetectionTimeout('Front side');

      try {
        await captureAndSendFramesFront('front');
        
        if (!stopRequestedRef.current) {
          clearDetectionTimeout();
          setDetectionActive(false);
          
          console.log('✅ Front scan successful! Resetting attempt count.');
          // FIXED: Reset attempts only on successful front scan
          setAttemptCount(0);
          setMaxAttemptsReached(false);
          setCurrentOperation('');
          setCurrentPhase('ready-for-back');
        }
        
      } catch (error) {
        console.error('Front side detection failed:', error);
        setDetectionActive(false);
        if (!stopRequestedRef.current) {
          handleDetectionFailure(`Front side detection failed: ${error.message}`, 'front');
        }
      }
    });
  };

  const startBackSideDetection = async () => {
    if (maxAttemptsReached) {
      console.log('🚫 Cannot start back scan - max attempts reached');
      return;
    }
    
    console.log('🔍 Starting back side detection...');
    setCurrentPhase('back-countdown');
    setErrorMessage('');

    startCountdown(async () => {
      if (stopRequestedRef.current) return;
      
      setCurrentPhase('back');
      setDetectionActive(true);
      stopRequestedRef.current = false;

      // Start detection timeout
      startDetectionTimeout('Back side');

      try {
        const finalResult = await captureAndSendFrames('back');
        
        if (!stopRequestedRef.current) {
          clearDetectionTimeout();
          setDetectionActive(false);
          
          console.log('🔍 Checking final result:', finalResult);
          
          if (finalResult.encrypted_card_data && finalResult.status) {
            console.log('🎯 Final encrypted response detected - Setting phase to final_response');
            console.log(`Status: ${finalResult.status}, Score: ${finalResult.score}`);
            setFinalOcrResults(finalResult);
            setCurrentPhase('final_response');
          } else if (finalResult.final_ocr) {
            console.log('📋 Regular OCR results - Setting phase to results');
            setFinalOcrResults(finalResult);
            setCurrentPhase('results');
          } else {
            console.log('⚠️ No final OCR or encrypted data found');
            setFinalOcrResults(finalResult);
            setCurrentPhase('results');
          }
          
          console.log('✅ Back scan successful! Resetting attempt count.');
          // FIXED: Reset attempts only on successful back scan
          setAttemptCount(0);
          setMaxAttemptsReached(false);
          setCurrentOperation('');
        }
        
      } catch (error) {
        console.error('Back side detection failed:', error);
        setDetectionActive(false);
        if (!stopRequestedRef.current) {
          handleDetectionFailure(`Back side detection failed: ${error.message}`, 'back');
        }
      }
    });
  };

  const resetApplication = () => {
    console.log('🔄 Resetting application completely...');
    stopRequestedRef.current = true;
    clearDetectionTimeout();
    
    setCurrentPhase('idle');
    setDetectionActive(false);
    setFinalOcrResults(null);
    setIsProcessing(false);
    setCountdown(0);
    setErrorMessage('');
    setSessionId('');
    
    // FIXED: Reset attempt tracking completely - this is for "Start New Session"
    setAttemptCount(0);
    setMaxAttemptsReached(false);
    setCurrentOperation('');
    
    setValidationState({
      physicalCard: false,
      movementState: null,
      movementMessage: '',
      validationComplete: false
    });
    setFrontScanState({
      framesBuffered: 0,
      chipDetected: false,
      bankLogoDetected: false,
      canProceedToBack: false
    });
    capturedFrames.current = [];
    
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    if (validationIntervalRef.current) {
      clearInterval(validationIntervalRef.current);
    }
    
    stopRequestedRef.current = false;
  };

  // FIXED: "Try Again" function - keeps attempt count but resets to appropriate phase
  const handleTryAgain = () => {
    console.log(`🔄 Trying again for operation: ${currentOperation}. Attempt count remains: ${attemptCount}`);
    
    stopRequestedRef.current = true;
    clearDetectionTimeout();
    
    // FIXED: Don't reset attempt count here - keep it for tracking
    setDetectionActive(false);
    setIsProcessing(false);
    setCountdown(0);
    setErrorMessage('');
    
    // Return to the appropriate phase based on what operation failed
    if (currentOperation === 'validation') {
      setCurrentPhase('idle');
      setValidationState({
        physicalCard: false,
        movementState: null,
        movementMessage: '',
        validationComplete: false
      });
    } else if (currentOperation === 'front') {
      setCurrentPhase('ready-for-front');
      setFrontScanState({
        framesBuffered: 0,
        chipDetected: false,
        bankLogoDetected: false,
        canProceedToBack: false
      });
    } else if (currentOperation === 'back') {
      setCurrentPhase('ready-for-back');
    } else {
      // Default fallback
      setCurrentPhase('idle');
    }
    
    // Clean up intervals
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    if (validationIntervalRef.current) {
      clearInterval(validationIntervalRef.current);
    }
    
    stopRequestedRef.current = false;
  };

  // FIXED: Start over function
  const handleStartOver = () => {
    console.log('🔄 Starting over - resetting attempt count');
    stopRequestedRef.current = true;
    clearDetectionTimeout();
    
    setCurrentPhase('idle');
    setErrorMessage('');
    
    // FIXED: Reset attempt tracking when starting over
    setAttemptCount(0);
    setMaxAttemptsReached(false);
    setCurrentOperation('');
    
    // Reset states
    setDetectionActive(false);
    setIsProcessing(false);
    setCountdown(0);
    
    setValidationState({
      physicalCard: false,
      movementState: null,
      movementMessage: '',
      validationComplete: false
    });
    
    setFrontScanState({
      framesBuffered: 0,
      chipDetected: false,
      bankLogoDetected: false,
      canProceedToBack: false
    });
    
    stopRequestedRef.current = false;
  };

  // Debug component for testing (only shows in development)
  const DebugAuth = () => {
    if (!authData || process.env.NODE_ENV === 'production') return null;
    
    return (
      <div className="fixed top-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded text-xs z-50">
        <div>Merchant: {authData.merchantId}</div>
        <div>Token: {authData.authToken.substring(0, 8)}...</div>
        <div>Source: {authData.source}</div>
        <div>Time: {new Date(authData.timestamp).toLocaleTimeString()}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-700 to-black p-4 sm:p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Debug info (only shows in development) */}
        {/* <DebugAuth /> */}
        
        <h1 className="text-xl bg-white p-2 sm:text-2xl lg:text-3xl  rounded-md font-bold text-center mb-4 sm:mb-8 text-gray-900">
          Card Security Scan
        </h1>

        <CameraView
          videoRef={videoRef}
          canvasRef={canvasRef}
          currentPhase={currentPhase}
          countdown={countdown}
          detectionActive={detectionActive}
          validationState={validationState}
          frontScanState={frontScanState}
          isProcessing={isProcessing}
        />

        <ControlPanel
          currentPhase={currentPhase}
          onStartValidation={startCardValidation}
          onStartFrontScan={startFrontSideDetection}
          onStartBackScan={startBackSideDetection}
          onStop={stopDetection}
          onReset={resetApplication}
          onTryAgain={handleTryAgain}
          onStartOver={handleStartOver}
          validationState={validationState}
          frontScanState={frontScanState}
          countdown={countdown}
          errorMessage={errorMessage}
          finalOcrResults={finalOcrResults}
          detectionActive={detectionActive}
          isProcessing={isProcessing}
          attemptCount={attemptCount}
          maxAttempts={MAX_ATTEMPTS}
          maxAttemptsReached={maxAttemptsReached}
        />

        <StatusInformation
          currentPhase={currentPhase}
          sessionId={sessionId}
          validationState={validationState}
          frontScanState={frontScanState}
          detectionActive={detectionActive}
        />

        <footer className="text-center text-sm text-gray-400 mt-8">
          © {new Date().getFullYear()} CardNest LLC. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default CardDetectionApp;