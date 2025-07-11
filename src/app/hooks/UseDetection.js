// import { useRef } from 'react';
// import { sendFrameToAPI } from '../utils/apiService';
// import { captureFrame } from '../utils/CameraUtils';

// // Custom hook for detection logic
// export const useDetection = (
//   videoRef,
//   canvasRef,
//   sessionId,
//   setSessionId,
//   setIsProcessing,
//   setCurrentPhase,
//   setErrorMessage,
//   setFrontScanState,
//   stopRequestedRef // Added this parameter from your main component
// ) => {
//   const captureIntervalRef = useRef(null);

//   // Capture and send frames for front side with chip and bank logo detection
//   const captureAndSendFramesFront = async (phase) => {
//     const currentSessionId = sessionId || `session_${Date.now()}`;
//     if (!sessionId) {
//       setSessionId(currentSessionId);
//     }
    
//     let lastApiResponse = null;
//     const maxFrames = 80;
    
//     if (!videoRef.current || videoRef.current.readyState < 2) {
//       throw new Error('Video not ready for capture');
//     }
    
//     return new Promise((resolve, reject) => {
//       let frameNumber = 0;
//       let timeoutId = null;
//       let isComplete = false;
      
//       const cleanup = () => {
//         if (captureIntervalRef.current) {
//           clearInterval(captureIntervalRef.current);
//           captureIntervalRef.current = null;
//         }
//         if (timeoutId) {
//           clearTimeout(timeoutId);
//           timeoutId = null;
//         }
//         setIsProcessing(false);
//       };
      
//       const processFrame = async () => {
//         try {
//           // FIXED: Check stopRequestedRef instead of abortControllerRef
//           if (isComplete || stopRequestedRef.current) return;
          
//           const frame = await captureFrame(videoRef, canvasRef);
          
//           if (frame && frame.size > 0) {
//             frameNumber++;
            
//             setIsProcessing(true);
//             try {
//               const apiResponse = await sendFrameToAPI(frame, phase, currentSessionId, frameNumber);
              
//               // FIXED: Check for validation states in both message_state AND movement_state
//               if (apiResponse.message_state === "VALIDATION_FAILED" || 
//                   apiResponse.movement_state === "VALIDATION_FAILED") {
//                 isComplete = true;
//                 cleanup();
//                 const errorMsg = apiResponse.message || 
//                                 apiResponse.movement_message || 
//                                 'Validation failed. Please try again.';
//                 setErrorMessage(errorMsg);
//                 setCurrentPhase('error');
//                 reject(new Error('Validation failed'));
//                 return;
//               }

//               if (apiResponse.message_state === "VALIDATION_PASSED" || 
//                   apiResponse.movement_state === "VALIDATION_PASSED") {
//                 isComplete = true;
//                 cleanup();
//                 setCurrentPhase('ready-for-front');
//                 resolve(apiResponse);
//                 return;
//               }
              
//               lastApiResponse = apiResponse;
//               setIsProcessing(false);
              
//               const bufferedFrames = apiResponse.buffer_info?.front_frames_buffered || 0;
//               const chipDetected = apiResponse.chip || false;
//               const bankLogoDetected = apiResponse.bank_logo || false;
              
//               setFrontScanState({
//                 framesBuffered: bufferedFrames,
//                 chipDetected: chipDetected,
//                 bankLogoDetected: bankLogoDetected,
//                 canProceedToBack: bufferedFrames >= 6 && chipDetected && bankLogoDetected
//               });
              
//               // Check if both chip AND bank logo are detected along with sufficient frames
//               if (bufferedFrames >= 6 && chipDetected && bankLogoDetected) {
//                 isComplete = true;
//                 cleanup();
//                 console.log(`Front side complete - 6 frames buffered, chip detected, and bank logo detected`);
//                 resolve(apiResponse);
//                 return;
//               }
              
//               if (frameNumber >= maxFrames) {
//                 isComplete = true;
//                 cleanup();
//                 console.log(`Reached maximum ${maxFrames} frames for ${phase} side`);
//                 if (lastApiResponse) {
//                   const buffered = lastApiResponse.buffer_info?.front_frames_buffered || 0;
//                   const chip = lastApiResponse.chip || false;
//                   const bankLogo = lastApiResponse.bank_logo || false;
                  
//                   if (buffered >= 6 && !chip && !bankLogo) {
//                     setErrorMessage('Card chip and bank logo not detected. Please ensure both the chip and bank logo are clearly visible and try again.');
//                   } else if (buffered >= 6 && !chip) {
//                     setErrorMessage('Card chip not detected. Please ensure the chip is clearly visible and try again.');
//                   } else if (buffered >= 6 && !bankLogo) {
//                     setErrorMessage('Bank logo not detected. Please ensure the bank logo is clearly visible and try again.');
//                   } else {
//                     setErrorMessage('Failed to capture sufficient frames. Please try again.');
//                   }
//                   setCurrentPhase('error');
//                   reject(new Error(`Failed to get all required conditions after ${maxFrames} attempts`));
//                 } else {
//                   reject(new Error(`Failed to get sufficient frames after ${maxFrames} attempts`));
//                 }
//                 return;
//               }
              
//             } catch (apiError) {
//               console.error(`API error for frame ${frameNumber}:`, apiError);
//               setIsProcessing(false);
//             }
//           }
//         } catch (error) {
//           console.error('Error in frame processing:', error);
//         }
//       };
      
//       processFrame();
//       captureIntervalRef.current = setInterval(processFrame, 1500);
      
//       timeoutId = setTimeout(() => {
//         if (!isComplete) {
//           cleanup();
//           if (lastApiResponse) {
//             console.log('Timeout reached, checking conditions...');
//             const bufferedFrames = lastApiResponse.buffer_info?.front_frames_buffered || 0;
//             const chipDetected = lastApiResponse.chip || false;
//             const bankLogoDetected = lastApiResponse.bank_logo || false;
            
//             if (bufferedFrames >= 6 && chipDetected && bankLogoDetected) {
//               resolve(lastApiResponse);
//               return;
//             }
            
//             if (bufferedFrames >= 6 && !chipDetected && !bankLogoDetected) {
//               setErrorMessage('Timeout: Chip and bank logo not detected. Please ensure both the chip and bank logo are clearly visible and try again.');
//             } else if (bufferedFrames >= 6 && !chipDetected) {
//               setErrorMessage('Timeout: Chip not detected. Please ensure the chip is clearly visible and try again.');
//             } else if (bufferedFrames >= 6 && !bankLogoDetected) {
//               setErrorMessage('Timeout: Bank logo not detected. Please ensure the bank logo is clearly visible and try again.');
//             } else if (bufferedFrames < 6) {
//               setErrorMessage('Timeout: Failed to capture sufficient frames. Please try again.');
//             }
            
//             setCurrentPhase('error');
//             reject(new Error('Timeout: Required conditions not met'));
//           } else {
//             reject(new Error('Timeout: No successful API responses received'));
//           }
//         }
//       }, 40000);
//     });
//   };

//   // Helper function to count detected back side features
//   const countBackSideFeatures = (apiResponse) => {
//     const features = {
//       magstrip: apiResponse.magstrip || false,
//       signstrip: apiResponse.signstrip || false,
//       hologram: apiResponse.hologram || false,
//       customer_service_detected: apiResponse.final_ocr?.customer_service.detected || false
//     };
    
//     return {
//       features,
//       count: Object.values(features).filter(Boolean).length,
//       detectedFeatures: Object.keys(features).filter(key => features[key])
//     };
//   };

//   // Regular capture function for back side with feature validation
//   const captureAndSendFrames = async (phase) => {
//     const currentSessionId = sessionId || `session_${Date.now()}`;
//     if (!sessionId) {
//       setSessionId(currentSessionId);
//     }
    
//     let lastApiResponse = null;
//     const maxFrames = 100;
//     const requiredBackSideFeatures = 3;
    
//     if (!videoRef.current || videoRef.current.readyState < 2) {
//       throw new Error('Video not ready for capture');
//     }
    
//     return new Promise((resolve, reject) => {
//       let frameNumber = 0;
//       let timeoutId = null;
//       let isComplete = false;
      
//       const cleanup = () => {
//         if (captureIntervalRef.current) {
//           clearInterval(captureIntervalRef.current);
//           captureIntervalRef.current = null;
//         }
//         if (timeoutId) {
//           clearTimeout(timeoutId);
//           timeoutId = null;
//         }
//         setIsProcessing(false);
//       };
      
//       const processFrame = async () => {
//         try {
//           // FIXED: Check stopRequestedRef instead of abortControllerRef
//           if (isComplete || stopRequestedRef.current) return;
          
//           const frame = await captureFrame(videoRef, canvasRef);
          
//           if (frame && frame.size > 0) {
//             frameNumber++;
            
//             setIsProcessing(true);
//             try {
//               const apiResponse = await sendFrameToAPI(frame, phase, currentSessionId, frameNumber);
              
//               // Check for validation states first (for validation phase)
//               if (phase === 'validation') {
//                 if (apiResponse.message_state === "VALIDATION_FAILED" || 
//                     apiResponse.movement_state === "VALIDATION_FAILED") {
//                   isComplete = true;
//                   cleanup();
//                   const errorMsg = apiResponse.message || 
//                                   apiResponse.movement_message || 
//                                   'Validation failed. Please try again.';
//                   setErrorMessage(errorMsg);
//                   setCurrentPhase('error');
//                   reject(new Error('Validation failed'));
//                   return;
//                 }

//                 if (apiResponse.message_state === "VALIDATION_PASSED" || 
//                     apiResponse.movement_state === "VALIDATION_PASSED") {
//                   isComplete = true;
//                   cleanup();
//                   setCurrentPhase('ready-for-front');
//                   resolve(apiResponse);
//                   return;
//                 }
//               }

//               // General validation state check for all phases
//               if (apiResponse.message_state === "VALIDATION_FAILED" || 
//                   apiResponse.movement_state === "VALIDATION_FAILED") {
//                 isComplete = true;
//                 cleanup();
//                 const errorMsg = apiResponse.message || 
//                                 apiResponse.movement_message || 
//                                 'Validation failed. Please try again.';
//                 setErrorMessage(errorMsg);
//                 setCurrentPhase('error');
//                 reject(new Error('Validation failed'));
//                 return;
//               }
              
//               lastApiResponse = apiResponse;
//               setIsProcessing(false);
              
//               const bufferedFrames = phase === 'front' 
//                 ? apiResponse.buffer_info?.front_frames_buffered 
//                 : apiResponse.buffer_info?.back_frames_buffered;
              
//               // For back side, check both sufficient frames and required features
//               if (phase === 'back' && bufferedFrames >= 6) {
//                 const { count, detectedFeatures } = countBackSideFeatures(apiResponse);
                
//                 if (count >= requiredBackSideFeatures) {
//                   isComplete = true;
//                   cleanup();
//                   console.log(`Back side complete - 6 frames buffered and ${count} features detected: ${detectedFeatures.join(', ')}`);
//                   resolve(apiResponse);
//                   return;
//                 }
//               } else if (phase !== 'back' && phase !== 'validation' && bufferedFrames >= 6) {
//                 isComplete = true;
//                 cleanup();
//                 console.log(`${phase} side complete - 6 frames buffered`);
//                 resolve(apiResponse);
//                 return;
//               }
              
//               if (frameNumber >= maxFrames) {
//                 isComplete = true;
//                 cleanup();
//                 console.log(`Reached maximum ${maxFrames} frames for ${phase} side`);
                
//                 if (lastApiResponse) {
//                   if (phase === 'back') {
//                     const buffered = lastApiResponse.buffer_info?.back_frames_buffered || 0;
//                     const { count, detectedFeatures } = countBackSideFeatures(lastApiResponse);
                    
//                     if (buffered >= 6 && count < requiredBackSideFeatures) {
//                       const missingCount = requiredBackSideFeatures - count;
//                       setErrorMessage(`Insufficient back side features detected. Found ${count} out of required ${requiredBackSideFeatures} features (${detectedFeatures.join(', ')}). Please ensure the card's back side is clearly visible showing magnetic strip, signature strip, hologram, and customer service details.`);
//                       setCurrentPhase('error');
//                       reject(new Error(`Insufficient back side features: only ${count}/${requiredBackSideFeatures} detected`));
//                     } else if (buffered < 6) {
//                       setErrorMessage('Failed to capture sufficient frames for back side. Please try again.');
//                       setCurrentPhase('error');
//                       reject(new Error('Insufficient frames captured for back side'));
//                     } else {
//                       resolve(lastApiResponse);
//                     }
//                   } else {
//                     resolve(lastApiResponse);
//                   }
//                 } else {
//                   reject(new Error(`Failed to get sufficient frames after ${maxFrames} attempts`));
//                 }
//                 return;
//               }
              
//             } catch (apiError) {
//               console.error(`API error for frame ${frameNumber}:`, apiError);
//               setIsProcessing(false);
//             }
//           }
//         } catch (error) {
//           console.error('Error in frame processing:', error);
//         }
//       };
      
//       processFrame();
//       captureIntervalRef.current = setInterval(processFrame, 1200);
      
//       timeoutId = setTimeout(() => {
//         if (!isComplete) {
//           cleanup();
//           if (lastApiResponse) {
//             console.log('Timeout reached, checking final conditions...');
            
//             if (phase === 'back') {
//               const bufferedFrames = lastApiResponse.buffer_info?.back_frames_buffered || 0;
//               const { count, detectedFeatures } = countBackSideFeatures(lastApiResponse);
              
//               if (bufferedFrames >= 6 && count >= requiredBackSideFeatures) {
//                 resolve(lastApiResponse);
//                 return;
//               } else if (bufferedFrames >= 6 && count < requiredBackSideFeatures) {
//                 setErrorMessage(`Timeout: Insufficient back side features detected. Found ${count} out of required ${requiredBackSideFeatures} features (${detectedFeatures.join(', ')}). Please ensure the card's back side is clearly visible.`);
//                 setCurrentPhase('error');
//                 reject(new Error(`Timeout: Insufficient back side features detected`));
//                 return;
//               }
//             }
            
//             console.log('Timeout reached, using last response');
//             resolve(lastApiResponse);
//           } else {
//             reject(new Error('Timeout: No successful API responses received'));
//           }
//         }
//       }, 120000);
//     });
//   };

//   return {
//     captureAndSendFramesFront,
//     captureAndSendFrames,
//     captureIntervalRef
//   };
// };








import { useRef } from 'react';
import { sendFrameToAPI } from '../utils/apiService';
import { captureFrame } from '../utils/CameraUtils';

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
    const maxFrames = 80;
    
    if (!videoRef.current || videoRef.current.readyState < 2) {
      throw new Error('Video not ready for capture');
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
          // FIXED: Check stopRequestedRef instead of abortControllerRef
          if (isComplete || stopRequestedRef.current) return;
          
          const frame = await captureFrame(videoRef, canvasRef);
          
          if (frame && frame.size > 0) {
            frameNumber++;
            
            setIsProcessing(true);
            try {
              const apiResponse = await sendFrameToAPI(frame, phase, currentSessionId, frameNumber);
              
              // FIXED: Check for validation states in both message_state AND movement_state
              if (apiResponse.message_state === "VALIDATION_FAILED" || 
                  apiResponse.movement_state === "VALIDATION_FAILED") {
                isComplete = true;
                cleanup();
                const errorMsg = apiResponse.message || 
                                apiResponse.movement_message || 
                                'Validation failed. Please try again.';
                setErrorMessage(errorMsg);
                setCurrentPhase('error');
                reject(new Error('Validation failed'));
                return;
              }

              if (apiResponse.message_state === "VALIDATION_PASSED" || 
                  apiResponse.movement_state === "VALIDATION_PASSED") {
                isComplete = true;
                cleanup();
                setCurrentPhase('ready-for-front');
                resolve(apiResponse);
                return;
              }
              
              lastApiResponse = apiResponse;
              setIsProcessing(false);
              
              const bufferedFrames = apiResponse.buffer_info?.front_frames_buffered || 0;
              const chipDetected = apiResponse.chip || false;
              const bankLogoDetected = apiResponse.bank_logo || false;
              
              setFrontScanState({
                framesBuffered: bufferedFrames,
                chipDetected: chipDetected,
                bankLogoDetected: bankLogoDetected,
                canProceedToBack: bufferedFrames >= 6 && chipDetected && bankLogoDetected
              });
              
              // Check if both chip AND bank logo are detected along with sufficient frames
              if (bufferedFrames >= 6 && chipDetected && bankLogoDetected) {
                isComplete = true;
                cleanup();
                console.log(`Front side complete - 6 frames buffered, chip detected, and bank logo detected`);
                resolve(apiResponse);
                return;
              }
              
              if (frameNumber >= maxFrames) {
                isComplete = true;
                cleanup();
                console.log(`Reached maximum ${maxFrames} frames for ${phase} side`);
                if (lastApiResponse) {
                  const buffered = lastApiResponse.buffer_info?.front_frames_buffered || 0;
                  const chip = lastApiResponse.chip || false;
                  const bankLogo = lastApiResponse.bank_logo || false;
                  
                  if (buffered >= 6 && !chip && !bankLogo) {
                    setErrorMessage('Card chip and bank logo not detected. Please ensure both the chip and bank logo are clearly visible and try again.');
                  } else if (buffered >= 6 && !chip) {
                    setErrorMessage('Card chip not detected. Please ensure the chip is clearly visible and try again.');
                  } else if (buffered >= 6 && !bankLogo) {
                    setErrorMessage('Bank logo not detected. Please ensure the bank logo is clearly visible and try again.');
                  } else {
                    setErrorMessage('Failed to capture sufficient frames. Please try again.');
                  }
                  setCurrentPhase('error');
                  reject(new Error(`Failed to get all required conditions after ${maxFrames} attempts`));
                } else {
                  reject(new Error(`Failed to get sufficient frames after ${maxFrames} attempts`));
                }
                return;
              }
              
            } catch (apiError) {
              console.error(`API error for frame ${frameNumber}:`, apiError);
              setIsProcessing(false);
              
              // Stop the scanning process on API failure
              isComplete = true;
              cleanup();
              setErrorMessage('Failed to connect to the server. Please check your internet connection and try again.');
              setCurrentPhase('error');
              reject(new Error(`API request failed: ${apiError.message}`));
              return;
            }
          }
        } catch (error) {
          console.error('Error in frame processing:', error);
        }
      };
      
      processFrame();
      captureIntervalRef.current = setInterval(processFrame, 1500);
      
      timeoutId = setTimeout(() => {
        if (!isComplete) {
          cleanup();
          if (lastApiResponse) {
            console.log('Timeout reached, checking conditions...');
            const bufferedFrames = lastApiResponse.buffer_info?.front_frames_buffered || 0;
            const chipDetected = lastApiResponse.chip || false;
            const bankLogoDetected = lastApiResponse.bank_logo || false;
            
            if (bufferedFrames >= 6 && chipDetected && bankLogoDetected) {
              resolve(lastApiResponse);
              return;
            }
            
            if (bufferedFrames >= 6 && !chipDetected && !bankLogoDetected) {
              setErrorMessage('Timeout: Chip and bank logo not detected. Please ensure both the chip and bank logo are clearly visible and try again.');
            } else if (bufferedFrames >= 6 && !chipDetected) {
              setErrorMessage('Timeout: Chip not detected. Please ensure the chip is clearly visible and try again.');
            } else if (bufferedFrames >= 6 && !bankLogoDetected) {
              setErrorMessage('Timeout: Bank logo not detected. Please ensure the bank logo is clearly visible and try again.');
            } else if (bufferedFrames < 6) {
              setErrorMessage('Timeout: Failed to capture sufficient frames. Please try again.');
            }
            
            setCurrentPhase('error');
            reject(new Error('Timeout: Required conditions not met'));
          } else {
            reject(new Error('Timeout: No successful API responses received'));
          }
        }
      }, 40000);
    });
  };

  // Helper function to count detected back side features
  const countBackSideFeatures = (apiResponse) => {
    const features = {
      magstrip: apiResponse.magstrip || false,
      signstrip: apiResponse.signstrip || false,
      hologram: apiResponse.hologram || false,
      customer_service_detected: apiResponse.final_ocr?.customer_service.detected || false
    };
    
    return {
      features,
      count: Object.values(features).filter(Boolean).length,
      detectedFeatures: Object.keys(features).filter(key => features[key])
    };
  };

  // Regular capture function for back side with complete_scan check
  const captureAndSendFrames = async (phase) => {
    const currentSessionId = sessionId || `session_${Date.now()}`;
    if (!sessionId) {
      setSessionId(currentSessionId);
    }
    
    let lastApiResponse = null;
    const maxFrames = 100;
    
    if (!videoRef.current || videoRef.current.readyState < 2) {
      throw new Error('Video not ready for capture');
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
          // FIXED: Check stopRequestedRef instead of abortControllerRef
          if (isComplete || stopRequestedRef.current) return;
          
          const frame = await captureFrame(videoRef, canvasRef);
          
          if (frame && frame.size > 0) {
            frameNumber++;
            
            setIsProcessing(true);
            try {
              const apiResponse = await sendFrameToAPI(frame, phase, currentSessionId, frameNumber);
              
              // Check for validation states first (for validation phase)
              if (phase === 'validation') {
                if (apiResponse.message_state === "VALIDATION_FAILED" || 
                    apiResponse.movement_state === "VALIDATION_FAILED") {
                  isComplete = true;
                  cleanup();
                  const errorMsg = apiResponse.message || 
                                  apiResponse.movement_message || 
                                  'Validation failed. Please try again.';
                  setErrorMessage(errorMsg);
                  setCurrentPhase('error');
                  reject(new Error('Validation failed'));
                  return;
                }

                if (apiResponse.message_state === "VALIDATION_PASSED" || 
                    apiResponse.movement_state === "VALIDATION_PASSED") {
                  isComplete = true;
                  cleanup();
                  setCurrentPhase('ready-for-front');
                  resolve(apiResponse);
                  return;
                }
              }

              // General validation state check for all phases
              if (apiResponse.message_state === "VALIDATION_FAILED" || 
                  apiResponse.movement_state === "VALIDATION_FAILED") {
                isComplete = true;
                cleanup();
                const errorMsg = apiResponse.message || 
                                apiResponse.movement_message || 
                                'Validation failed. Please try again.';
                setErrorMessage(errorMsg);
                setCurrentPhase('error');
                reject(new Error('Validation failed'));
                return;
              }
              
              lastApiResponse = apiResponse;
              setIsProcessing(false);
              
              const bufferedFrames = phase === 'front' 
                ? apiResponse.buffer_info?.front_frames_buffered 
                : apiResponse.buffer_info?.back_frames_buffered;
              
              // For back side, check for complete_scan flag and status
              if (phase === 'back' && apiResponse.complete_scan === true) {
                // Check if status is retry
                if (apiResponse.status === "retry") {
                  isComplete = true;
                  cleanup();
                  console.log(`Back side complete_scan is true but status is retry - restarting from front scan`);
                  setErrorMessage('Scan needs to be retried. Please start the scanning process from front side again.');
                  setCurrentPhase('error');
                  reject(new Error('Status is retry - need to restart from front scan'));
                  return;
                } else {
                  // Status is not retry, check old conditions (3/4 features)
                  const { count } = countBackSideFeatures(apiResponse);
                  const requiredBackSideFeatures = 3;
                  
                  if (count >= requiredBackSideFeatures) {
                    isComplete = true;
                    cleanup();
                    console.log(`Back side complete - complete_scan is true, status is not retry, and ${count}/4 features detected`);
                    resolve(apiResponse);
                    return;
                  } else {
                    console.log(`Back side complete_scan is true but insufficient features: ${count}/4 detected`);
                    // Continue processing more frames to get more features
                  }
                }
              } else if (phase !== 'back' && phase !== 'validation' && bufferedFrames >= 6) {
                isComplete = true;
                cleanup();
                console.log(`${phase} side complete - 6 frames buffered`);
                resolve(apiResponse);
                return;
              }
              
              if (frameNumber >= maxFrames) {
                isComplete = true;
                cleanup();
                console.log(`Reached maximum ${maxFrames} frames for ${phase} side`);
                
                if (lastApiResponse) {
                  if (phase === 'back') {
                    if (lastApiResponse.complete_scan === true) {
                      if (lastApiResponse.status === "retry") {
                        console.log('Max frames reached, complete_scan is true but status is retry');
                        setErrorMessage('Scan needs to be retried. Please start the scanning process from front side again.');
                        setCurrentPhase('error');
                        reject(new Error('Status is retry - need to restart from front scan'));
                      } else {
                        // Check old conditions (3/4 features)
                        const { count, detectedFeatures } = countBackSideFeatures(lastApiResponse);
                        const requiredBackSideFeatures = 3;
                        
                        if (count >= requiredBackSideFeatures) {
                          console.log('Max frames reached, complete_scan is true, status is not retry, and sufficient features detected, resolving');
                          resolve(lastApiResponse);
                        } else {
                          setErrorMessage(`Insufficient back side features detected. Found ${count} out of required ${requiredBackSideFeatures} features (${detectedFeatures.join(', ')}). Please ensure the card's back side is clearly visible.`);
                          setCurrentPhase('error');
                          reject(new Error(`Insufficient back side features: only ${count}/${requiredBackSideFeatures} detected`));
                        }
                      }
                    } else {
                      setErrorMessage('Back side scan incomplete. Please ensure the card\'s back side is clearly visible and all features are detected.');
                      setCurrentPhase('error');
                      reject(new Error('Back side scan not complete after maximum frames'));
                    }
                  } else {
                    resolve(lastApiResponse);
                  }
                } else {
                  reject(new Error(`Failed to get sufficient frames after ${maxFrames} attempts`));
                }
                return;
              }
              
            } catch (apiError) {
              console.error(`API error for frame ${frameNumber}:`, apiError);
              setIsProcessing(false);
              
              // Stop the scanning process on API failure
              isComplete = true;
              cleanup();
              setErrorMessage('Failed to connect to the server. Please check your internet connection and try again.');
              setCurrentPhase('error');
              reject(new Error(`API request failed: ${apiError.message}`));
              return;
            }
          }
        } catch (error) {
          console.error('Error in frame processing:', error);
        }
      };
      
      processFrame();
      captureIntervalRef.current = setInterval(processFrame, 1200);
      
      timeoutId = setTimeout(() => {
        if (!isComplete) {
          cleanup();
          if (lastApiResponse) {
            console.log('Timeout reached, checking final conditions...');
            
            if (phase === 'back') {
              if (lastApiResponse.complete_scan === true) {
                if (lastApiResponse.status === "retry") {
                  console.log('Timeout reached, complete_scan is true but status is retry');
                  setErrorMessage('Scan needs to be retried. Please start the scanning process from front side again.');
                  setCurrentPhase('error');
                  reject(new Error('Timeout: Status is retry - need to restart from front scan'));
                  return;
                } else {
                  // Check old conditions (3/4 features)
                  const { count, detectedFeatures } = countBackSideFeatures(lastApiResponse);
                  const requiredBackSideFeatures = 3;
                  
                  if (count >= requiredBackSideFeatures) {
                    console.log('Timeout reached, complete_scan is true, status is not retry, and sufficient features detected, resolving');
                    resolve(lastApiResponse);
                    return;
                  } else {
                    setErrorMessage(`Timeout: Insufficient back side features detected. Found ${count} out of required ${requiredBackSideFeatures} features (${detectedFeatures.join(', ')}). Please ensure the card's back side is clearly visible.`);
                    setCurrentPhase('error');
                    reject(new Error('Timeout: Insufficient back side features detected'));
                    return;
                  }
                }
              } else {
                setErrorMessage('Timeout: Back side scan incomplete. Please ensure the card\'s back side is clearly visible and try again.');
                setCurrentPhase('error');
                reject(new Error('Timeout: Back side scan not complete'));
                return;
              }
            }
            
            console.log('Timeout reached, using last response');
            resolve(lastApiResponse);
          } else {
            reject(new Error('Timeout: No successful API responses received'));
          }
        }
      }, 120000);
    });
  };

  return {
    captureAndSendFramesFront,
    captureAndSendFrames,
    captureIntervalRef
  };
};