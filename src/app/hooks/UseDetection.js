import { useRef } from "react";
import { sendFrameToAPI } from "../utils/apiService";
import { captureFrame } from "../utils/CameraUtils";

// Custom hook for detection logic
export const useDetection = (
  videoRef,
  canvasRef,
  sessionId,
  setSessionId,
  setIsProcessing,
  setCurrentPhase,
  setErrorMessage,
  setFrontScanState,
  stopRequestedRef, // Added this parameter from your main component
  setNeedsRestartFromFront, // Added flag setter for restart scenarios
  clearDetectionTimeout // Added to clear external timeout when fake card detected
) => {
  const captureIntervalRef = useRef(null);
  const currentTimeoutRef = useRef(null); // Track current detection timeout

  // Helper function to clear any existing detection timeouts
  const clearAllTimeouts = () => {
    if (currentTimeoutRef.current) {
      clearTimeout(currentTimeoutRef.current);
      currentTimeoutRef.current = null;
      console.log("🔧 Cleared existing detection timeout");
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
      console.log("🔧 Cleared existing capture interval");
    }
  };



const captureAndSendFramesFront = async (phase, passedSessionId) => {
    // Clear any existing timeouts/intervals before starting new detection
    clearAllTimeouts();
    
    // Create unique detection ID for debugging
    const detectionId = Math.random().toString(36).substr(2, 9);
    console.log(`🆔 Starting ${phase} detection with ID: ${detectionId}`);
    
    // Use passed session ID if available, otherwise fallback to state or create new
    const currentSessionId = passedSessionId || sessionId || `session_${Date.now()}`;
    if (!passedSessionId && !sessionId) {
      setSessionId(currentSessionId);
      console.log("Fallback session ID created in captureAndSendFramesFront:", currentSessionId);
    } else {
      console.log("Using existing session ID:", currentSessionId);
    }

    let lastApiResponse = null;
    const maxFrames = 20;

    if (!videoRef.current || videoRef.current.readyState < 2) {
      throw new Error("Video not ready for capture");
    }

    return new Promise((resolve, reject) => {
      let frameNumber = 0;
      let timeoutId = null;
      let isComplete = false;
      let isProcessingFrame = false; // Prevent concurrent API calls

      const cleanup = () => {
        if (captureIntervalRef.current) {
          clearInterval(captureIntervalRef.current);
          captureIntervalRef.current = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (currentTimeoutRef.current) {
          clearTimeout(currentTimeoutRef.current);
          currentTimeoutRef.current = null;
        }
        setIsProcessing(false);
        isProcessingFrame = false;
      };

      const processFrame = async () => {
        try {
          if (isComplete || stopRequestedRef.current) {
            console.log(`🛑 ${detectionId}: Skipping frame processing (isComplete: ${isComplete}, stopRequested: ${stopRequestedRef.current})`);
            return;
          }

          if (isProcessingFrame) {
            console.log(`🛑 ${detectionId}: Already processing frame, skipping duplicate call`);
            return;
          }

          isProcessingFrame = true;
          const frame = await captureFrame(videoRef, canvasRef);

          if (frame && frame.size > 0) {
            frameNumber++;
            setIsProcessing(true);

            try {
              const apiResponse = await sendFrameToAPI(
                frame,
                phase,
                currentSessionId,
                frameNumber
              );

              lastApiResponse = apiResponse;
              setIsProcessing(false);
              isProcessingFrame = false; // Reset processing flag

              // ⚠️ PRIORITY CHECK: Fake card detection - check first before anything else
              if (apiResponse.fake_card === true) {
                isComplete = true;
                
                // Clear timeout FIRST before cleanup
                if (timeoutId) {
                  clearTimeout(timeoutId);
                  timeoutId = null;
                  console.log("🔧 Cleared internal timeout for fake card detection");
                }
                
                cleanup();
                
                if (clearDetectionTimeout) {
                  clearDetectionTimeout();
                  console.log("🔧 Cleared external timeout for fake card detection");
                }
                
                console.log("❌ Fake card detected - failing detection immediately");
                setErrorMessage("Fake card detected. Please use original card.");
                setCurrentPhase("error");
                reject(new Error("Fake card detected"));
                return;
              }

              const bufferedFrames =
                apiResponse.buffer_info?.front_frames_buffered || 0;
              const chipDetected = apiResponse.chip || false;
              const bankLogoDetected = apiResponse.bank_logo || false;
              const physicalCard = apiResponse.physical_card || false;
              const motionProgress = apiResponse.motion_progress || null;

              const showMotionPrompt = motionProgress === "1/2";
              const hideMotionPrompt = motionProgress === "2/2";

              setFrontScanState({
                framesBuffered: bufferedFrames,
                chipDetected,
                bankLogoDetected,
                physicalCardDetected: physicalCard,
                canProceedToBack:
                  bufferedFrames >= 4 &&
                  (chipDetected || bankLogoDetected) && // CHANGED: Either chip OR bank logo
                  physicalCard,
                motionProgress,
                showMotionPrompt,
                hideMotionPrompt,
              });

              // ✅ Success check - CHANGED: Either chip OR bank logo required
              if (
                bufferedFrames >= 4 &&
                (chipDetected || bankLogoDetected) && // CHANGED: Either chip OR bank logo
                physicalCard
              ) {
                isComplete = true;
                
                // Clear timeout explicitly before cleanup
                if (timeoutId) {
                  clearTimeout(timeoutId);
                  timeoutId = null;
                  console.log("🔧 Cleared timeout on successful front completion");
                }
                
                cleanup();
                
                if (clearDetectionTimeout) {
                  clearDetectionTimeout();
                  console.log("🔧 Cleared external timeout on successful front completion");
                }
                
                console.log(
                  `✅ Front side complete (${detectionId}) - physical card detected with either chip or bank logo`
                );
                resolve(apiResponse);
                return;
              }

              if (frameNumber >= maxFrames) {
                isComplete = true;
                cleanup();
                console.log(
                  `Reached maximum ${maxFrames} frames for ${phase} side`
                );

                if (lastApiResponse) {
                  // ⚠️ PRIORITY CHECK: Check fake card detection even when max frames reached
                  if (lastApiResponse.fake_card === true) {
                    if (timeoutId) {
                      clearTimeout(timeoutId);
                      timeoutId = null;
                    }
                    if (clearDetectionTimeout) {
                      clearDetectionTimeout();
                    }
                    console.log("❌ Max frames: Fake card detected");
                    setErrorMessage("Fake card detected. Please use original card.");
                    setCurrentPhase("error");
                    reject(new Error("Max frames: Fake card detected"));
                    return;
                  }
                  
                  const buffered =
                    lastApiResponse.buffer_info?.front_frames_buffered || 0;
                  const chip = lastApiResponse.chip || false;
                  const bankLogo = lastApiResponse.bank_logo || false;
                  const physical = lastApiResponse.physical_card || false;

                  if (buffered >= 4 && (!chip && !bankLogo || !physical)) { // CHANGED: Error message logic
                    if (!chip && !bankLogo && !physical) {
                      setErrorMessage(
                        "Neither chip nor bank logo detected, and physical card not detected. Please ensure at least one feature is visible."
                      );
                    } else if (!physical) {
                      setErrorMessage(
                        "Physical card not detected. Please ensure you're scanning a real card."
                      );
                    } else if (!chip && !bankLogo) {
                      setErrorMessage(
                        "Neither chip nor bank logo detected. Please ensure at least one is clearly visible."
                      );
                    }
                  } else {
                    setErrorMessage(
                      "Failed to capture sufficient frames. Please try again."
                    );
                  }

                  setCurrentPhase("error");
                  reject(
                    new Error(
                      `Failed to get all required conditions after ${maxFrames} attempts`
                    )
                  );
                } else {
                  reject(
                    new Error(
                      `Failed to get sufficient frames after ${maxFrames} attempts`
                    )
                  );
                }
                return;
              }
            } catch (apiError) {
              console.error(`API error for frame ${frameNumber}:`, apiError);
              setIsProcessing(false);
              isProcessingFrame = false; // Reset processing flag
              isComplete = true;
              cleanup();
              setErrorMessage(
                "Failed to connect to the server. Please check your internet connection and try again."
              );
              setCurrentPhase("error");
              reject(new Error(`API request failed: ${apiError.message}`));
              return;
            }
          } else {
            isProcessingFrame = false; // Reset flag if no frame captured
          }
        } catch (error) {
          console.error("Error in frame processing:", error);
          isProcessingFrame = false; // Reset flag on any error
        }
      };

      processFrame();
      captureIntervalRef.current = setInterval(processFrame, 800);

      timeoutId = setTimeout(() => {
        console.log(`🕐 Timeout handler triggered for ${detectionId}. isComplete: ${isComplete}, timeoutId: ${timeoutId}`);
        
        // Double-check if timeout was already cleared
        if (timeoutId === null) {
          console.log(`🔧 Timeout for ${detectionId} was cleared, ignoring execution`);
          return;
        }
        
        if (isComplete) {
          console.log(`🔧 Detection ${detectionId} already completed, ignoring timeout`);
          return;
        }
        
        // Check if we've moved past the front phase - if so, don't trigger timeout error
        // This prevents front phase timeout from firing during back phase or results
        if (lastApiResponse && lastApiResponse.buffer_info?.front_frames_buffered >= 4) {
          console.log(`🔧 Front phase ${detectionId} was successful (sufficient frames buffered), ignoring timeout`);
          return;
        }
        
        console.log(`⏰ Proceeding with timeout logic for ${detectionId}`);
        isComplete = true;
        cleanup();
        
        if (lastApiResponse) {
          console.log("Timeout reached, checking conditions...");
          
          // ⚠️ PRIORITY CHECK: Check fake card detection even on timeout
          if (lastApiResponse.fake_card === true) {
            if (clearDetectionTimeout) {
              clearDetectionTimeout();
            }
            console.log("❌ Timeout: Fake card detected");
            setErrorMessage("Fake card detected. Please use original card.");
            setCurrentPhase("error");
            reject(new Error("Timeout: Fake card detected"));
            return;
          }
            
          const bufferedFrames =
            lastApiResponse.buffer_info?.front_frames_buffered || 0;
          const chipDetected = lastApiResponse.chip || false;
          const bankLogoDetected = lastApiResponse.bank_logo || false;
          const physicalCard = lastApiResponse.physical_card || false;

          // CHANGED: Either chip OR bank logo required
          if (
            bufferedFrames >= 4 &&
            (chipDetected || bankLogoDetected) &&
            physicalCard
          ) {
            isComplete = true;
            cleanup();
            resolve(lastApiResponse);
            return;
          }

          if (
            bufferedFrames >= 4 &&
            (!chipDetected && !bankLogoDetected || !physicalCard)
          ) {
            if (!chipDetected && !bankLogoDetected && !physicalCard) {
              setErrorMessage(
                "Timeout: Neither chip nor bank logo detected, and physical card not detected."
              );
            } else if (!physicalCard) {
              setErrorMessage(
                "Timeout: Physical card not detected. Please ensure you're scanning a real card."
              );
            } else if (!chipDetected && !bankLogoDetected) {
              setErrorMessage(
                "Timeout: Neither chip nor bank logo detected. Please ensure at least one is visible."
              );
            }
          } else {
            setErrorMessage(
              "Timeout: Failed to capture sufficient frames. Please try again."
            );
          }

          setCurrentPhase("error");
          reject(new Error("Timeout: Required conditions not met"));
        } else {
          reject(new Error("Timeout: No successful API responses received"));
        }
      }, 15000); // 15 second timeout
      
      // Store timeout ID in ref for cleanup
      currentTimeoutRef.current = timeoutId;
    });
  };





  // Helper function to count detected back side features
  const countBackSideFeatures = (apiResponse) => {
    const features = {
      magstrip: apiResponse.magstrip || false,
      signstrip: apiResponse.signstrip || false,
      hologram: apiResponse.hologram || false,
      customer_service_detected:
        apiResponse.final_ocr?.customer_service.detected || false,
    };

    return {
      features,
      count: Object.values(features).filter(Boolean).length,
      detectedFeatures: Object.keys(features).filter((key) => features[key]),
    };
  };

  // Regular capture function for back side with complete_scan check
  const captureAndSendFrames = async (phase, passedSessionId) => {
    // Clear any existing timeouts/intervals before starting new detection
    clearAllTimeouts();
    
    // Use passed session ID if available, otherwise fallback to state or create new
    const currentSessionId = passedSessionId || sessionId || `session_${Date.now()}`;
    if (!passedSessionId && !sessionId) {
      setSessionId(currentSessionId);
      console.log("Fallback session ID created in captureAndSendFrames:", currentSessionId);
    } else {
      console.log("Using existing session ID:", currentSessionId);
    }

    let lastApiResponse = null;
    const maxFrames = 15;

    if (!videoRef.current || videoRef.current.readyState < 2) {
      throw new Error("Video not ready for capture");
    }

    return new Promise((resolve, reject) => {
      const detectionId = Math.random().toString(36).substr(2, 9); // Unique ID for this detection
      console.log(`🆔 Starting ${phase} detection with ID: ${detectionId}`);
      
      let frameNumber = 0;
      let timeoutId = null;
      let isComplete = false;
      let isProcessingFrame = false; // Prevent concurrent API calls

      const cleanup = () => {
        if (captureIntervalRef.current) {
          clearInterval(captureIntervalRef.current);
          captureIntervalRef.current = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (currentTimeoutRef.current) {
          clearTimeout(currentTimeoutRef.current);
          currentTimeoutRef.current = null;
        }
        setIsProcessing(false);
      };

      const processFrame = async () => {
        try {
          // Check stopRequestedRef
          if (isComplete || stopRequestedRef.current) {
            console.log(`🛑 ${detectionId}: Skipping frame processing (isComplete: ${isComplete}, stopRequested: ${stopRequestedRef.current})`);
            return;
          }

          if (isProcessingFrame) {
            console.log(`🛑 ${detectionId}: Already processing frame, skipping duplicate call`);
            return;
          }

          isProcessingFrame = true;
          const frame = await captureFrame(videoRef, canvasRef);

          if (frame && frame.size > 0) {
            frameNumber++;

            setIsProcessing(true);
            try {
              const apiResponse = await sendFrameToAPI(
                frame,
                phase,
                currentSessionId,
                frameNumber
              );

              lastApiResponse = apiResponse;
              setIsProcessing(false);
              isProcessingFrame = false; // Reset processing flag

              const bufferedFrames =
                phase === "front"
                  ? apiResponse.buffer_info?.front_frames_buffered
                  : apiResponse.buffer_info?.back_frames_buffered;

              // For back side, check for complete_scan flag and status
              if (phase === "back" && apiResponse.complete_scan === true) {
                // Check if status is retry_meriJaan with validation_failed
                if (apiResponse.status === "retry_meriJaan" && apiResponse.validation_failed === true) {
                  isComplete = true;
                  cleanup();
                  console.log(
                    `Back side failed due to brand mismatch - restarting from front scan`
                  );
                  setNeedsRestartFromFront(true); // Set restart flag
                  setErrorMessage(
                    "Oops, after numerous security scan detection your card issuer verification details do not match the bank records - please try again. Thank you!!"
                  );
                  setCurrentPhase("error");
                  reject(
                    new Error(
                      "retry_meriJaan - card issuer verification failed"
                    )
                  ); 
                  return;                  
                }
                // Check if status is regular retry
                else if (apiResponse.status === "retry") {
                  isComplete = true;
                  cleanup();
                  console.log(
                    `Back side complete_scan is true but status is retry - restarting from front scan`
                  );
                  setNeedsRestartFromFront(true); // Set restart flag
                  setErrorMessage(
                    "Scan needs to be retried. Please start the scanning process from front side again."
                  );
                  setCurrentPhase("error");
                  reject(
                    new Error(
                      "Status is retry - need to restart from front scan"
                    )
                  ); 
                  return;
                } 
             
                
                
                else {
                  // Status is not retry, check old conditions (3/4 features)
                  const { count } = countBackSideFeatures(apiResponse);
                  const requiredBackSideFeatures = 2;

                  if (count >= requiredBackSideFeatures) {
                    isComplete = true;
                    
                    // Clear timeout explicitly before cleanup
                    if (timeoutId) {
                      clearTimeout(timeoutId);
                      timeoutId = null;
                      console.log("🔧 Cleared internal timeout for successful back completion");
                    }
                    
                    cleanup();
                    
                    if (clearDetectionTimeout) {
                      clearDetectionTimeout();
                      console.log("🔧 Cleared external timeout for successful back completion");
                    }
                    
                    console.log(
                      `Back side complete - complete_scan is true, status is not retry, and ${count}/4 features detected`
                    );
                    console.log(`🔧 DEBUG: Detection ${detectionId} - isComplete set to true, cleanup called, resolving with response`);
                    resolve(apiResponse);
                    return;
                  } else {
                    console.log(`Back side complete_scan is true`);
                    isComplete = true;
                    cleanup();
                    resolve(apiResponse);
                    return;
                  }
                }
              } 
              
              else if (phase !== "back" && bufferedFrames >= 4) {
                isComplete = true;
                cleanup();
                console.log(`${phase} side complete - 4 frames buffered`);
                resolve(apiResponse);
                return;
              }

              if (frameNumber >= maxFrames) {
                isComplete = true;
                cleanup();
                console.log(
                  `Reached maximum ${maxFrames} frames for ${phase} side`
                );

                if (lastApiResponse) {
                  if (phase === "back") {
                    if (lastApiResponse.complete_scan === true ) {
                      if (lastApiResponse.status === "retry") {
                        console.log(
                          "Max frames reached, complete_scan is true but status is retry"
                        );
                        setNeedsRestartFromFront(true); // Set restart flag
                        setErrorMessage(
                          "Scan needs to be retried. Please start the scanning process from front side again."
                        );
                        setCurrentPhase("error");
                        reject(
                          new Error(
                            "Status is retry - need to restart from front scan"
                          )
                        );
                      } else {
                        // Check old conditions (3/4 features)
                        const { count, detectedFeatures } =
                          countBackSideFeatures(lastApiResponse);
                        const requiredBackSideFeatures = 2;

                        if (count >= requiredBackSideFeatures) {
                          console.log(
                            "Max frames reached, complete_scan is true, status is not retry, and sufficient features detected, resolving"
                          );
                          isComplete = true;
                          cleanup();
                          resolve(lastApiResponse);
                        } else {
                          setErrorMessage(
                            `Insufficient back side features detected. Found ${count} out of required ${requiredBackSideFeatures} features (${detectedFeatures.join(
                              ", "
                            )}). Please ensure the card's back side is clearly visible.`
                          );
                          setCurrentPhase("error");
                          reject(
                            new Error(
                              `Insufficient back side features: only ${count}/${requiredBackSideFeatures} detected`
                            )
                          );
                        }
                      }
                    } else {
                      setErrorMessage(
                        "Back side scan incomplete. Please ensure the card's back side is clearly visible and all features are detected."
                      );
                      setCurrentPhase("error");
                      reject(
                        new Error(
                          "Back side scan not complete after maximum frames"
                        )
                      );
                    }
                  } else {
                    isComplete = true;
                    cleanup();
                    resolve(lastApiResponse);
                  }
                } else {
                  reject(
                    new Error(
                      `Failed to get sufficient frames after ${maxFrames} attempts`
                    )
                  );
                }
                return;
              }
            } catch (apiError) {
              console.error(`API error for frame ${frameNumber}:`, apiError);
              setIsProcessing(false);
              isProcessingFrame = false; // Reset processing flag

              // Stop the scanning process on API failure
              isComplete = true;
              cleanup();
              setErrorMessage(
                "Failed to connect to the server. Please check your internet connection and try again."
              );
              setCurrentPhase("error");
              reject(new Error(`API request failed: ${apiError.message}`));
              return;
            }
          } else {
            isProcessingFrame = false; // Reset flag if no frame captured
          }
        } catch (error) {
          console.error("Error in frame processing:", error);
          isProcessingFrame = false; // Reset flag on any error
        }
      };

      processFrame();
      captureIntervalRef.current = setInterval(processFrame, 800);

      timeoutId = setTimeout(() => {
        console.log(`🔧 DEBUG: Detection ${detectionId} - Timeout fired. isComplete: ${isComplete}, timeoutId: ${timeoutId}`);
        
        // Double-check if timeout was already cleared
        if (timeoutId === null) {
          console.log(`🔧 Timeout for ${detectionId} was cleared, ignoring execution`);
          return;
        }
        
        // Double-check isComplete in case of race condition
        if (isComplete) {
          console.log(`🔧 DEBUG: Detection ${detectionId} - isComplete is true, ignoring timeout`);
          return;
        }
        
        // Check if back phase was successful - if complete_scan is true and we have features, don't trigger error
        if (phase === "back" && lastApiResponse && lastApiResponse.complete_scan === true) {
          const { count } = countBackSideFeatures(lastApiResponse);
          if (count >= 2) {
            console.log(`🔧 Back phase ${detectionId} was successful (complete_scan: true, ${count} features), ignoring timeout`);
            return;
          }
        }
        
        console.log(`⏰ Proceeding with timeout logic for ${detectionId}`);
        isComplete = true;
        cleanup();
        
        if (lastApiResponse) {
          console.log("Timeout reached, checking final conditions...");

            if (phase === "back") {
              if (lastApiResponse.complete_scan === true) {
                if (lastApiResponse.status === "retry") {
                  console.log(
                    "Timeout reached, complete_scan is true but status is retry"
                  );
                  setNeedsRestartFromFront(true); // Set restart flag
                  setErrorMessage(
                    "Scan needs to be retried. Please start the scanning process from front side again."
                  );
                  setCurrentPhase("error");
                  reject(
                    new Error(
                      "Timeout: Status is retry - need to restart from front scan"
                    )
                  );
                  return;
                } else {
                  // Check old conditions (3/4 features)
                  const { count, detectedFeatures } =
                    countBackSideFeatures(lastApiResponse);
                  const requiredBackSideFeatures = 2;

                  if (count >= requiredBackSideFeatures) {
                    console.log(
                      "Timeout reached, complete_scan is true, status is not retry, and sufficient features detected, resolving"
                    );
                    resolve(lastApiResponse);
                    return;
                  } else {
                    setErrorMessage(
                      `Timeout: Insufficient back side features detected. Found ${count} out of required ${requiredBackSideFeatures} features (${detectedFeatures.join(
                        ", "
                      )}). Please ensure the card's back side is clearly visible.`
                    );
                    setCurrentPhase("error");
                    reject(
                      new Error(
                        "Timeout: Insufficient back side features detected"
                      )
                    );
                    return;
                  }
                }
              } else {
                setErrorMessage(
                  "Timeout: Back side scan incomplete. Please ensure the card's back side is clearly visible and try again."
                );
                setCurrentPhase("error");
                reject(new Error("Timeout: Back side scan not complete"));
                return;
              }
            }

            console.log("Timeout reached, using last response");
            resolve(lastApiResponse);
        } else {
          reject(new Error("Timeout: No successful API responses received"));
        }
      }, 20000); // 20 second timeout
    });
  };

  return {
    captureAndSendFramesFront,
    captureAndSendFrames,
    captureIntervalRef,
    clearAllTimeouts, // Export for external cleanup
  };
};



