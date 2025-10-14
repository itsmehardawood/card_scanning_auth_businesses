import React, { useState, useEffect } from "react";
import {
  ArrowBigUp,
  ArrowBigDown,
  ArrowBigLeft,
  ArrowBigRight,
} from "lucide-react";

const CameraView = ({
  videoRef,
  canvasRef,
  currentPhase,
  countdown,
  detectionActive,
  validationState,
  frontScanState,
  isProcessing,
  showPromptText,
  promptText,
}) => {
  const [showMotionPrompt, setShowMotionPrompt] = useState(false);
  const [motionPromptShown, setMotionPromptShown] = useState(false);
  const [showGuidelinesPrompt, setShowGuidelinesPrompt] = useState(false);
  const [guidelinesPromptShown, setGuidelinesPromptShown] = useState(false);

  // Debug log to see current phase

  // Handle motion prompt display with 3-second timer - show only once
  useEffect(() => {
    if (
      currentPhase === "front" &&
      frontScanState?.showMotionPrompt &&
      !motionPromptShown
    ) {
      setShowMotionPrompt(true);
      setMotionPromptShown(true); // Mark as shown to prevent showing again

      // Hide the prompt after 3 seconds
      const timer = setTimeout(() => {
        setShowMotionPrompt(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [currentPhase, frontScanState?.showMotionPrompt, motionPromptShown]);

  // Handle guidelines prompt display during ready-for-front phase - show until countdown starts
  useEffect(() => {
    // Show guidelines for initial states or ready-for-front phase
    if (
      (currentPhase === "ready-for-front" || !currentPhase || currentPhase === "idle") &&
      countdown === 0
    ) {
      // console.log("🎯 Showing guidelines prompt for phase:", currentPhase);
      setShowGuidelinesPrompt(true);
      // Don't set guidelinesPromptShown to true here - let it show each time we return to ready-for-front
    }
    
    // Hide guidelines prompt when countdown starts (front-countdown phase)
    if (currentPhase === "front-countdown" || countdown > 0) {
      console.log("🎯 Hiding guidelines prompt - countdown started");
      setShowGuidelinesPrompt(false);
      setGuidelinesPromptShown(true); // Only mark as shown when we actually start scanning
    }
  }, [currentPhase, countdown]);
  
  // Immediately hide motion prompt when motion progress reaches 2/2
  useEffect(() => {
    if (frontScanState?.hideMotionPrompt) {
      console.log("🎯 Motion 2/2 detected - hiding motion prompt immediately");
      setShowMotionPrompt(false);
    }
  }, [frontScanState?.hideMotionPrompt]);

  // Reset the prompt shown flag when phase changes or detection restarts
  useEffect(() => {
    if (currentPhase !== "front") {
      setMotionPromptShown(false);
      setShowMotionPrompt(false);
    }
    
    // Only hide guidelines prompt when moving to actual scanning phases
    if (currentPhase === "front" || currentPhase === "back" || currentPhase === "results" || currentPhase === "error") {
      setShowGuidelinesPrompt(false);
    }
  }, [currentPhase]);

  // Reset motion prompt when frames are reset (new scan session)
  useEffect(() => {
    if (frontScanState?.framesBuffered === 0) {
      setMotionPromptShown(false);
      setShowMotionPrompt(false);
      // Don't reset guidelines prompt here - let the phase-based logic handle it
      // setGuidelinesPromptShown(false);
      // setShowGuidelinesPrompt(false);
    }
  }, [frontScanState?.framesBuffered]);
  const getPhaseInstructions = () => {
    switch (currentPhase) {
      case "ready-for-front":
        return 'Carefully read our guidelines or recommendation information for better scanning.';
      case "front-countdown":
        return `Get ready to scan front side... ${countdown}`;
      case "front":
        return "Keep front side in the frame. While Processing...";
      case "ready-for-back":
        return "Turn to the backside and start scanning card";
      case "back-countdown":
        return `Get ready to scan back side... ${countdown}`;
      case "back":
        return "Keep Back side in the frame. While Processing...";
      case "results":
        return "Thank you, your card Scan is completed successfully";
      case "error":
        return "";
      case "max-attempts-reached":
        return "Maximum attempts reached. Please contact support.";
      default:
        return "Thank you, your card Scan is completed successfully";
    }
  };

  // Check if we should show the scanning animation
  const showScanningAnimation =
    detectionActive && (currentPhase === "front" || currentPhase === "back");

  // Check if we should show validation arrows
  const showValidationArrows = false; // Removed validation arrows since no validation phase

  // Get arrow direction based on validation state
  const getArrowDirection = () => {
    if (!validationState?.movementState) return null;

    switch (validationState.movementState) {
      case "MOVE_UP":
        return "up";
      case "MOVE_DOWN":
        return "down";
      case "MOVE_LEFT":
        return "left";
      case "MOVE_RIGHT":
        return "right";
      default:
        return null;
    }
  };

  // Arrow component for validation phase

  const ValidationArrows = ({ direction }) => {
    if (!direction) return null;

    const animationClass = "animate-pulse";
    const arrowSize = "w-16 h-16 sm:w-20 sm:h-20";

    const arrowStyle = {
      filter: "drop-shadow(0 0 8px rgba(0, 0, 0, 0.6))", // black shadow @ 60%
      strokeWidth: "2.5",
    };

    const commonStyle = {
      ...arrowStyle,
      fill: "#6FE7B2", // even lighter green inside of the arrow color
      stroke: "#000000", // black border color around the arrow
      color: "#000000", // black border color for icon
    };

    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-15">
        <div className="relative w-3/4 h-3/4">
          {direction === "up" && (
            <div
              className={`absolute top-2 left-1/2 transform -translate-x-1/2 ${animationClass}`}
            >
              <ArrowBigUp className={arrowSize} style={commonStyle} />
            </div>
          )}

          {direction === "down" && (
            <div
              className={`absolute bottom-2 left-1/2 transform -translate-x-1/2 ${animationClass}`}
            >
              <ArrowBigDown className={arrowSize} style={commonStyle} />
            </div>
          )}

          {direction === "left" && (
            <div
              className={`absolute left-2 top-1/2 transform -translate-y-1/2 ${animationClass}`}
            >
              <ArrowBigLeft className={arrowSize} style={commonStyle} />
            </div>
          )}

          {direction === "right" && (
            <div
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 ${animationClass}`}
            >
              <ArrowBigRight className={arrowSize} style={commonStyle} />
            </div>
          )}
        </div>
      </div>
    );
  };

  // Don't render camera view if we're in results phase
  if (currentPhase === "results") {
    return (
      <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <svg
              className="w-12 h-12 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">
            Scan Complete!
          </h2>
          <p className="text-lg font-medium text-gray-800">
            {getPhaseInstructions()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
      <div className="relative overflow-hidden">
        {/* Camera Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-64 sm:h-80 lg:h-[420px] rounded-lg object-cover"
        />

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Card Frame (Thinner) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="relative w-3/4 h-3/4">
            {/* 4 Corner Borders (thinner) */}
            <div className="absolute top-0 left-0 w-6 h-1 bg-white" />
            <div className="absolute top-0 left-0 w-1 h-6 bg-white" />
            <div className="absolute top-0 right-0 w-6 h-1 bg-white" />
            <div className="absolute top-0 right-0 w-1 h-6 bg-white" />
            <div className="absolute bottom-0 left-0 w-6 h-1 bg-white" />
            <div className="absolute bottom-0 left-0 w-1 h-6 bg-white" />
            <div className="absolute bottom-0 right-0 w-6 h-1 bg-white" />
            <div className="absolute bottom-0 right-0 w-1 h-6 bg-white" />
          </div>
        </div>

        {/* Validation Arrows - Only during validation phase */}
        {showValidationArrows && (
          <ValidationArrows direction={getArrowDirection()} />
        )}

        {/* Scanning Animation - Only for front and back phases */}
        {showScanningAnimation && (
          <>
            {/* Animated scanning lines */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-15">
              <div className="relative w-3/4 h-3/4">
                {/* Main scanning line */}
                <div className="absolute left-0 right-0 h-0.5 bg-green-400 shadow-lg animate-scan-vertical opacity-90"></div>

                {/* Secondary scanning line with delay */}
                <div className="absolute left-0 right-0 h-0.5 bg-green-300 shadow-md animate-scan-vertical-delayed opacity-70"></div>

                {/* Subtle glow effect */}
                <div className="absolute left-0 right-0 h-1 bg-green-400 blur-sm animate-scan-vertical opacity-50"></div>
              </div>
            </div>

            {/* Scanning grid overlay for extra effect */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-12">
              <div className="relative w-3/4 h-3/4">
                {/* Horizontal grid lines */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={`h-${i}`}
                    className="absolute left-0 right-0 h-px bg-green-200 opacity-20"
                    style={{ top: `${(i + 1) * 12.5}%` }}
                  />
                ))}
                {/* Vertical grid lines */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={`v-${i}`}
                    className="absolute top-0 bottom-0 w-px bg-green-200 opacity-20"
                    style={{ left: `${(i + 1) * 16.66}%` }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Countdown Overlay with Prompt Text */}
        {countdown > 0 && (
          <div className="absolute inset-0 bg-black/30 bg-opacity-70 flex flex-col items-center justify-center rounded-lg z-25">
            {/* Countdown Number */}
            <div className="text-6xl font-bold text-white animate-pulse mb-4">
              {countdown}
            </div>

            {/* Prompt Text during countdown */}
            {showPromptText && promptText && (
              <div className="bg-black/90 backdrop-blur-sm rounded-lg p-4 mx-4 max-w-md text-center shadow-lg border-2 border-blue-500">
                <div className="text-blue-600 text-lg font-semibold mb-2">
                  Position Your Card
                </div>
                <div className="text-gray-500 text-sm leading-relaxed">
                  {promptText}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detection Active Indicator (Top-Right) */}
        {detectionActive && (
          <div className="absolute top-1 right-2 z-30">
            <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span>DETECTING</span>
            </div>
          </div>
        )}

        {/* Motion Progress Prompt - Show when motion_progress is "1/2" for 3 seconds */}
        {showMotionPrompt && (
          <div className="absolute inset-0 flex items-center justify-center z-40">
            <div className="bg-black/90 backdrop-blur-sm rounded-lg p-4 mx-4 max-w-md text-center shadow-lg border-2 border-blue-500">
              {/* Title */}
              <div className="text-blue-600 text-lg font-semibold mb-2">
                Motion Required
              </div>

              {/* Message */}
              <div className="text-gray-100 text-sm leading-relaxed mb-2">
                Please move your card slightly for optimal scanning detection
              </div>

              {/* Action indicator */}
              <div className="flex items-center justify-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
                <span className="text-xs text-blue-300 ml-2">
                  Adjusting position...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Guidelines Prompt - Show during ready-for-front phase until countdown starts */}
        {/* {console.log("🔍 JSX Guidelines check:", { showGuidelinesPrompt, currentPhase, countdown })} */}
        {showGuidelinesPrompt && (
          <div className="absolute inset-0 flex items-center justify-center z-40">
            <div className="bg-black/90 backdrop-blur-sm rounded-lg p-4 mx-4 max-w-md text-center shadow-lg border-2 border-blue-500">
              {/* Title */}
              <div className="text-blue-600 text-lg font-semibold mb-2">
                Guidelines for better scanning
              </div>

              {/* Message */}
              <div className="text-gray-100 text-sm leading-relaxed mb-2">
                We recommend putting the card on a flat surface, avoiding dark places, and positioning your card in the camera view for better scanning
              </div>

        
            </div>
          </div>
        )}
      </div>

      {currentPhase !== "results" && validationState?.movementMessage && (
        <div className="mt-4 text-center">
          <div
            className={`text-white text-sm px-6 py-3 rounded-2xl border-2 border-red-600 shadow-md inline-block
             ${
               validationState.movementMessage === "Physical Card Validated!"
                 ? "bg-green-500"
                 : validationState.movementMessage === "Validation Failed"
                 ? "bg-red-500"
                 : "bg-gray-700"
             }`}
          >
            {validationState.movementMessage}
          </div>
        </div>
      )}

      {/* Phase Instructions */}
      <div className="mt-4 text-center">
        <p className="text-lg font-medium text-gray-800">
          {getPhaseInstructions()}
        </p>
      </div>

      {/* Custom CSS for scanning animations */}
      <style jsx>{`
        @keyframes scan-vertical {
          0% {
            top: 0%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }

        @keyframes scan-vertical-delayed {
          0% {
            top: 0%;
            opacity: 0;
          }
          20% {
            opacity: 0;
          }
          30% {
            opacity: 0.7;
          }
          70% {
            opacity: 0.7;
          }
          80% {
            opacity: 0;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }

        .animate-scan-vertical {
          animation: scan-vertical 3s ease-in-out infinite;
        }

        .animate-scan-vertical-delayed {
          animation: scan-vertical-delayed 3s ease-in-out infinite;
          animation-delay: 0.5s;
        }
      `}</style>
    </div>
  );
};

export default CameraView;
