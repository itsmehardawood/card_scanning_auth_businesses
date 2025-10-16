// API Service for Card Detection

// Report failure to the backend when max retries are reached
export const reportFailure = async (scanId, failureStage, failureReason) => {
  try {
    console.log(`🚨 Reporting failure - scanId: ${scanId}, stage: ${failureStage}, reason: ${failureReason}`);
    
    const requestBody = {
      scan_id: scanId,
      failure_stage: failureStage,
      failure_reason: failureReason
    };

    // console.log("📤 SENDING TO REPORT_FAILURE API:");
    // console.log("   📍 URL: https://7d0b282842f7.ngrok-free.app/report_failure");
    // console.log("   📋 Request Body:", JSON.stringify(requestBody, null, 2));
    // console.log("   🔍 Details:");
    // console.log(`      - scan_id: "${scanId}"`);
    // console.log(`      - failure_stage: "${failureStage}"`);
    // console.log(`      - failure_reason: "${failureReason}"`);

    const response = await fetch("https://testscan.cardnest.io/report_failure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Report failure API error:", errorText);
      throw new Error(`Report failure API request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Failure reported successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Error reporting failure:", error);
    // Don't throw error here - failure reporting shouldn't block the UI
    return null;
  }
};

export const sendFrameToAPI = async (frame, phase, sessionId, frameNumber, scanId) => {
  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData();

      formData.append("file", frame, `${phase}_frame_${frameNumber}.jpg`);
      formData.append("phase", phase);
      formData.append("session_id", sessionId);

      console.log(
        `Sending frame ${frameNumber} for ${phase} phase to API (attempt ${attempt})...`
      );

      // Construct API endpoint with scanId
      // const apiEndpoint = scanId
      //   ? `https://testscan.cardnest.io/detect/card/v2/${scanId}`
      //   : "https://testscan.cardnest.io/detect/card/v2";
  


       const apiEndpoint = scanId
        ? `https://testscan.cardnest.io/detect/card/v2/${scanId}`
      //  ? `https://b11f964acdc5.ngrok-free.app/detect/card/v2/${scanId}`

        : "https://testscan.cardnest.io/detect/card/v2";

      console.log(`Using API endpoint: ${apiEndpoint}`);
    




      const response = await fetch(apiEndpoint, {
      
        method: "POST",
        body: formData,
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", errorText); 
        throw new Error(
          `API request failed: ${response.status} - ${errorText}`
        );
      }

      const result = await response.json();
      console.log(`API Response for frame ${frameNumber}:`, result);
      return result;
    } catch (error) {
      console.error(
        `API request failed for frame ${frameNumber} (attempt ${attempt}):`,
        error
      );
      lastError = error;

      if (attempt < maxRetries) {
        console.log(`Retrying frame ${frameNumber} in 1 second...`);
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  }

  throw lastError;
};
