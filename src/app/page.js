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

    // Merchant info state
  const [merchantInfo, setMerchantInfo] = useState({
    display_name: '',
    display_logo: '',
    merchant_id: '',
    loading: true,
    error: null
  });

  // Existing state management
  const [currentPhase, setCurrentPhase] = useState('idle');
  const [detectionActive, setDetectionActive] = useState(false);
  const [finalOcrResults, setFinalOcrResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionId, setSessionId] = useState('');
     const lockedRef = useRef(false); // 👈 add this


    useEffect(() => {
  const fetchMerchantInfo = async () => {
    // Use manual scanId if scanId from URL is not available
    const currentScanId =  'a7b3c07c-a24d-43f9-bfc6-6453f654afa9';
    
    if (!currentScanId) {
      setMerchantInfo(prev => ({
        ...prev,
        loading: false,
        error: 'Scan ID not found in URL'
      }));
      return;
    }

    try {
      console.log('🔍 Fetching merchant info for scanId:', currentScanId);
      setMerchantInfo(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch(`https://admin.cardnest.io/api/getmerchantscanInfo?scanId=${currentScanId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 Merchant info response:', result);

      if (result.status === true && result.data) {
        setMerchantInfo({
          display_name: result.data.display_name || '',
          display_logo: result.data.display_logo || '',
          merchant_id: result.data.merchant_id || '',
          loading: false,
          error: null
        });
        console.log('✅ Merchant info loaded successfully');
      } else {
        throw new Error(result.message || 'Failed to fetch merchant information');
      }
    } catch (error) {
      console.error('❌ Error fetching merchant info:', error);
      setMerchantInfo(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load merchant information'
      }));
    }
  };

  fetchMerchantInfo();
}, []);

  
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

  // Initialize camera on component mount
  useEffect(() => {
    initializeCamera(videoRef)
      .then(() => {
        console.log('📷 Camera initialized successfully');
      })
      .catch((error) => {
        console.error('❌ Camera initialization failed:', error);
        setErrorMessage('Camera access failed. Please allow camera permissions.');
      });
    
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
  }, []);

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
      setDetectionActive(true); // ADD THIS LINE!
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
            setDetectionActive(false); // MAKE SURE THIS EXISTS

          
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
          
            setDetectionActive(false); // MAKE SURE THIS EXISTS

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


// Inside your try block
try {
  const finalResult = await captureAndSendFrames('back');

  if (!stopRequestedRef.current && !lockedRef.current) {
    clearDetectionTimeout();
    setDetectionActive(false);

    if (finalResult.encrypted_card_data && finalResult.status) {
      lockedRef.current = true; // ✅ lock success state
      setFinalOcrResults(finalResult);
      setCurrentPhase('final_response');
    } else if (finalResult.final_ocr) {
      setFinalOcrResults(finalResult);
      setCurrentPhase('results');
    } else {
      setFinalOcrResults(finalResult);
      setCurrentPhase('results');
    }

    setAttemptCount(0);
    setMaxAttemptsReached(false);
    setCurrentOperation('');
  }
} catch (error) {
  setDetectionActive(false);
  if (!stopRequestedRef.current && !lockedRef.current) {
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
  
  // Keep stop flag as true to prevent auto-starting
  stopRequestedRef.current = true;
  clearDetectionTimeout();
  
  // Clean up intervals FIRST
  if (captureIntervalRef.current) {
    clearInterval(captureIntervalRef.current);
    captureIntervalRef.current = null;
  }
  if (countdownIntervalRef.current) {
    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = null;
  }
  if (validationIntervalRef.current) {
    clearInterval(validationIntervalRef.current);
    validationIntervalRef.current = null;
  }
  
  // Reset states
  setDetectionActive(false);
  setIsProcessing(false);
  setCountdown(0);
  setErrorMessage('');
  
  // Check if we need to restart from front scan
  if (currentOperation === 'back' && 
      (errorMessage.includes('start the scanning process from front side again') ||
       errorMessage.includes('need to restart from front scan'))) {
    // Restart from front scan
    setCurrentPhase('ready-for-front');
    setCurrentOperation('front');
    setFrontScanState({
      framesBuffered: 0,
      chipDetected: false,
      bankLogoDetected: false,
      canProceedToBack: false
    });
  } else {
    // Normal retry logic
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
      setCurrentPhase('idle');
    }
  }
  
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-700 to-black p-4 sm:p-4">
      <div className="container mx-auto max-w-4xl">

        <div className="text-center mb-4 sm:mb-8">
  {/* Merchant Info Section - Only show if data is available and not loading */}
  {!merchantInfo.loading && !merchantInfo.error && merchantInfo.display_name && (
    <div className="flex flex-col bg-white sm:flex-row items-center justify-center gap-2 py-2 sm:gap-4 mb-3 sm:mb-4">
      {/* Display Logo */}
      {merchantInfo.display_logo && (
        <img 
          src={merchantInfo.display_logo} 
          alt={merchantInfo.display_name}
          className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 object-contain rounded-md"
        />
      )}
      
      {/* Display Name */}
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-black">
        {merchantInfo.display_name}
      </h2>
    </div>
  )}
  
  {/* Main Title */}
  <h1 className="text-xl bg-white p-2 sm:text-2xl lg:text-3xl rounded-md font-bold text-gray-900">
    Card Security Scan
  </h1>
</div>


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