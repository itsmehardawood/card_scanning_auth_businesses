import React from "react";
import JsonResponseViewer from "./JsonFormate";

const DetectionResults = ({ finalOcrResults, onReset }) => {
  if (!finalOcrResults) return null;

  const {
    final_ocr,
    confidence,
    physical_card,
    chip,
    bank_logo,
    magstrip,
    signstrip,
    customer_service_detected,
    hologram,
    symmetry,
  } = finalOcrResults;

  return (
    <div className="bg-white rounded-lg shadow-lg p-1 sm:p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold text-center my-4 sm:my-7 text-green-600">
        Card Security Scan Successful
      </h2>

      {/* Final OCR Results */}
      {final_ocr && (
        <div className="mb-6 p-3 sm:p-4 bg-green-50 border text-black border-green-200 rounded-lg">
          <h3 className="text-base sm:text-lg font-semibold mb-3 text-green-700">
            Scanning and Detection Results
          </h3>
          <div className="grid gap-3">
            {final_ocr.cardholder_name && (
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-white rounded border gap-2">
                <span className="font-medium text-sm sm:text-base">
                  Cardholder Name
                </span>
                <div className="text-left sm:text-right">
                  <div className="font-mono text-sm sm:text-base">
                    {final_ocr.cardholder_name.value}
                  </div>
                  {/* <div className="text-xs sm:text-sm text-gray-500">
                    Confidence: {Math.round(final_ocr.cardholder_name.confidence * 100)}%
                  </div> */}
                </div>
              </div>
            )}

            {final_ocr.card_number && (
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-white rounded border gap-2">
                <span className="font-medium text-sm sm:text-base">
                  Card Number
                </span>
                <div className="text-left sm:text-right">
                  <div className="font-mono text-sm sm:text-base">
                    {final_ocr.card_number.value}
                  </div>
                  {/* <div className="text-xs sm:text-sm text-gray-500">
                    Confidence: {Math.round(final_ocr.card_number.confidence * 100)}%
                  </div> */}
                </div>
              </div>
            )}

            {final_ocr.expiry_date && (
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-white rounded border gap-2">
                <span className="font-medium text-sm sm:text-base">
                  Expiry Date
                </span>
                <div className="text-left sm:text-right">
                  <div className="font-mono text-sm sm:text-base">
                    {final_ocr.expiry_date.value}
                  </div>
                  {/* <div className="text-xs sm:text-sm text-gray-500">
                    Confidence: {Math.round(final_ocr.expiry_date.confidence * 100)}%
                  </div> */}
                </div>
              </div>
            )}

            {final_ocr.bank_name && (
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-white rounded border gap-2">
                <span className="font-medium text-sm sm:text-base">
                  Bank Name
                </span>
                <div className="text-left sm:text-right">
                  <div className="font-mono text-sm sm:text-base">
                    {final_ocr.bank_name.value}
                  </div>
                  {/* <div className="text-xs sm:text-sm text-gray-500">
                    Confidence: {Math.round(final_ocr.bank_name.confidence * 100)}%
                  </div> */}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detection Summary */}
      
      <div className="mb-6 p-3 sm:p-4 bg-blue-50 border text-black border-blue-200 rounded-lg">
        <h3 className="text-base sm:text-lg font-semibold mb-3 text-blue-700">
          Detection Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span>Overall Confidence:</span>
              <span className="font-medium">{Math.round(confidence)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Physical Card:</span>
              <span
                className={physical_card ? "text-green-600" : "text-red-600"}
              >
                {physical_card ? "Detected" : "Not Detected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Chip:</span>
              <span className={chip ? "text-green-600" : "text-red-600"}>
                {chip ? "Detected" : "Not Detected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Bank Logo:</span>
              <span className={bank_logo ? "text-green-600" : "text-red-600"}>
                {bank_logo ? "Detected" : "Not Detected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Hologram:</span>
              <span className={hologram ? "text-green-600" : "text-red-600"}>
                {hologram ? "Detected" : "Not Detected"}
              </span>
            </div>
          </div>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span>Magnetic Strip:</span>
              <span className={magstrip ? "text-green-600" : "text-red-600"}>
                {magstrip ? "Detected" : "Not Detected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Signature Strip:</span>
              <span className={signstrip ? "text-green-600" : "text-red-600"}>
                {signstrip ? "Detected" : "Not Detected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Customer Service:</span>
              <span
                className={
                  final_ocr.customer_service.detected
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {final_ocr.customer_service.detected
                  ? "Detected"
                  : "Not Detected"}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Symmetry:</span>
              <span className={symmetry ? "text-green-600" : "text-red-600"}>
                {symmetry ? "Detected" : "Not Detected"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Raw JSON Response Viewer */}

      {/* <JsonResponseViewer data={finalOcrResults} />  */}

      <div className="text-center my-4">
        <button
          onClick={onReset}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
        >
          Start New Detection
        </button>
      </div>
    </div>
  );
};

export default DetectionResults;
