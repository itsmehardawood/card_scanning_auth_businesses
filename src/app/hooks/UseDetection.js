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
  stopRequestedRef // Added this parameter from your main component
) => {
  const captureIntervalRef = useRef(null);

  // Capture and send frames for front side with chip and bank logo detection
  const captureAndSendFramesFront = async (phase) => {
    const currentSessionId = sessionId || `session_${Date.now()}`;
    if (!sessionId) {
      setSessionId(currentSessionId);
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

      const cleanup = () => {
        if (captureIntervalRef.current) {
          clearInterval(captureIntervalRef.current);
          captureIntervalRef.current = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        setIsProcessing(false);
      };

      const processFrame = async () => {
        try {
          if (isComplete || stopRequestedRef.current) return;

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

              // ⚠️ PRIORITY CHECK: Fake card detection - check first before anything else
              if (apiResponse.fake_card === true) {
                isComplete = true;
                cleanup();
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
                  bufferedFrames >= 6 &&
                  chipDetected &&
                  bankLogoDetected &&
                  physicalCard,
                motionProgress,
                showMotionPrompt,
                hideMotionPrompt,
              });

              // ✅ Success check
              if (
                bufferedFrames >= 6 &&
                chipDetected &&
                bankLogoDetected &&
                physicalCard
              ) {
                isComplete = true;
                cleanup();
                console.log(
                  "Front side complete - chip, bank logo, and physical card detected"
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

                  if (buffered >= 6 && (!chip || !bankLogo || !physical)) {
                    if (!chip && !bankLogo && !physical) {
                      setErrorMessage(
                        "Card chip, bank logo, and physical card not detected. Please ensure all are visible."
                      );
                    } else if (!chip) {
                      setErrorMessage(
                        "Card chip not detected. Please ensure the chip is clearly visible."
                      );
                    } else if (!bankLogo) {
                      setErrorMessage(
                        "Bank logo not detected. Please ensure the bank logo is clearly visible."
                      );
                    } else if (!physical) {
                      setErrorMessage(
                        "Physical card not detected. Please ensure you're scanning a real card."
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
              isComplete = true;
              cleanup();
              setErrorMessage(
                "Failed to connect to the server. Please check your internet connection and try again."
              );
              setCurrentPhase("error");
              reject(new Error(`API request failed: ${apiError.message}`));
              return;
            }
          }
        } catch (error) {
          console.error("Error in frame processing:", error);
        }
      };

      processFrame();
      captureIntervalRef.current = setInterval(processFrame, 1300);

      timeoutId = setTimeout(() => {
        if (!isComplete) {
          cleanup();
          if (lastApiResponse) {
            console.log("Timeout reached, checking conditions...");
            
            // ⚠️ PRIORITY CHECK: Check fake card detection even on timeout
            if (lastApiResponse.fake_card === true) {
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

            if (
              bufferedFrames >= 6 &&
              chipDetected &&
              bankLogoDetected &&
              physicalCard
            ) {
              resolve(lastApiResponse);
              return;
            }

            if (
              bufferedFrames >= 6 &&
              (!chipDetected || !bankLogoDetected || !physicalCard)
            ) {
              if (!chipDetected && !bankLogoDetected && !physicalCard) {
                setErrorMessage(
                  "Timeout: Chip, bank logo, and physical card not detected."
                );
              } else if (!chipDetected) {
                setErrorMessage(
                  "Timeout: Chip not detected. Please ensure the chip is visible."
                );  
                
              } else if (!bankLogoDetected) {
                setErrorMessage(
                  "Timeout: Bank logo not detected. Please ensure the logo is visible."
                );
              } else if (!physicalCard) {
                setErrorMessage(
                  "Timeout: Physical card not detected. Please ensure you're scanning a real card."
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
        }
      }, 120000);
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
  const captureAndSendFrames = async (phase) => {
    const currentSessionId = sessionId || `session_${Date.now()}`;
    if (!sessionId) {
      setSessionId(currentSessionId);
    }

    let lastApiResponse = null;
    const maxFrames = 15;

    if (!videoRef.current || videoRef.current.readyState < 2) {
      throw new Error("Video not ready for capture");
    }

    return new Promise((resolve, reject) => {
      let frameNumber = 0;
      let timeoutId = null;
      let isComplete = false;

      const cleanup = () => {
        if (captureIntervalRef.current) {
          clearInterval(captureIntervalRef.current);
          captureIntervalRef.current = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        setIsProcessing(false);
      };

      const processFrame = async () => {
        try {
          // Check stopRequestedRef
          if (isComplete || stopRequestedRef.current) return;

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

              const bufferedFrames =
                phase === "front"
                  ? apiResponse.buffer_info?.front_frames_buffered
                  : apiResponse.buffer_info?.back_frames_buffered;

              // For back side, check for complete_scan flag and status
              if (phase === "back" && apiResponse.complete_scan === true) {
                // Check if status is retry
                if (apiResponse.status === "retry") {
                  isComplete = true;
                  cleanup();
                  console.log(
                    `Back side complete_scan is true but status is retry - restarting from front scan`
                  );
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
                } else {
                  // Status is not retry, check old conditions (3/4 features)
                  const { count } = countBackSideFeatures(apiResponse);
                  const requiredBackSideFeatures = 2;

                  if (count >= requiredBackSideFeatures) {
                    isComplete = true;
                    cleanup();
                    console.log(
                      `Back side complete - complete_scan is true, status is not retry, and ${count}/4 features detected`
                    );
                    resolve(apiResponse);
                    return;
                  } else {
                    console.log(`Back side complete_scan is true`);
                    isComplete = true;
                    cleanup();
                    //  resolve(apiResponse);
                  }
                }
              } else if (phase !== "back" && bufferedFrames >= 6) {
                isComplete = true;
                cleanup();
                console.log(`${phase} side complete - 6 frames buffered`);
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
                    if (lastApiResponse.complete_scan === true) {
                      if (lastApiResponse.status === "retry") {
                        console.log(
                          "Max frames reached, complete_scan is true but status is retry"
                        );
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
          }
        } catch (error) {
          console.error("Error in frame processing:", error);
        }
      };

      processFrame();
      captureIntervalRef.current = setInterval(processFrame, 1200);

      timeoutId = setTimeout(() => {
        if (!isComplete) {
          cleanup();
          if (lastApiResponse) {
            console.log("Timeout reached, checking final conditions...");

            if (phase === "back") {
              if (lastApiResponse.complete_scan === true) {
                if (lastApiResponse.status === "retry") {
                  console.log(
                    "Timeout reached, complete_scan is true but status is retry"
                  );
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
        }
      }, 120000);
    });
  };

  return {
    captureAndSendFramesFront,
    captureAndSendFrames,
    captureIntervalRef,
  };
};



