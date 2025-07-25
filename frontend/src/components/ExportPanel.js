import React, { useState } from 'react';
import { useMutation } from 'react-query';
import toast from 'react-hot-toast';
import { useApi } from '../hooks/useAuth';

export default function ExportPanel() {
  const api = useApi();
  const [apiKey, setApiKey] = useState('');
  const [sampleFormat, setSampleFormat] = useState('');
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Default sample format
  const defaultSampleFormat = `{
  "metadata": {
    "export_date": "2024-01-15",
    "total_images": 0,
    "total_scores": 0
  },
  "images": [
    {
      "filename": "image_001.jpg",
      "original_name": "sample_image.jpg",
      "dataset": "drowsiness_study_2024",
      "scores": [
        {
          "scorer": "user123",
          "kss_score": 5,
          "explanation": "Person shows moderate signs of sleepiness...",
          "time_spent": 45,
          "scored_date": "2024-01-15T10:30:00Z"
        }
      ],
      "statistics": {
        "average_score": 5.2,
        "score_count": 3,
        "min_score": 4,
        "max_score": 7
      }
    }
  ]
}`;

  // Excel export mutation
  const excelExportMutation = useMutation(api.exportExcel, {
    onSuccess: (response) => {
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kss_scores_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Excel file downloaded successfully!');
      setIsExporting(false);
    },
    onError: (error) => {
      console.error('Excel export error:', error);
      toast.error(error.response?.data?.error || 'Failed to export Excel file');
      setIsExporting(false);
    }
  });

  // LLM JSON export mutation
  const llmExportMutation = useMutation(
    () => api.exportLLMJson(apiKey, sampleFormat.trim() || defaultSampleFormat, includeExplanations),
    {
      onSuccess: (response) => {
        const blob = new Blob([response.data], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `kss_scores_formatted_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('LLM-formatted JSON file downloaded successfully!');
        setIsExporting(false);
      },
      onError: (error) => {
        console.error('LLM export error:', error);
        toast.error(error.response?.data?.error || 'Failed to export LLM-formatted JSON');
        setIsExporting(false);
      }
    }
  );

  const handleExcelExport = () => {
    setIsExporting(true);
    excelExportMutation.mutate();
  };

  const handleLLMExport = () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your OpenAI API key');
      return;
    }
    
    setIsExporting(true);
    llmExportMutation.mutate();
  };

  const resetSampleFormat = () => {
    setSampleFormat(defaultSampleFormat);
  };

  const clearSampleFormat = () => {
    setSampleFormat('');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="text-xl font-semibold mb-6">Data Export</h2>
      
      <div className="space-y-6">
        {/* Excel Export Section */}
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="text-lg font-medium mb-3 text-blue-900">Export to Excel</h3>
          <p className="text-gray-600 mb-4">
            Export all scoring data to Excel spreadsheet, including user information, image details, KSS scores, explanations and complete data.
          </p>
          <button
            onClick={handleExcelExport}
            disabled={isExporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting && excelExportMutation.isLoading ? 'Exporting...' : 'Download Excel File'}
          </button>
        </div>

        {/* LLM JSON Export Section */}
        <div className="border rounded-lg p-4 bg-green-50">
          <h3 className="text-lg font-medium mb-3 text-green-900">AI Formatted Export</h3>
          <p className="text-gray-600 mb-4">
            Use LLM to reorganize and export data according to your specified JSON format. Requires OpenAI API Key.
          </p>
          
          <div className="space-y-4">
            {/* API Key Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your API Key is only used for this export and will not be saved
              </p>
            </div>

            {/* Sample Format Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  JSON Format Sample
                </label>
                <div className="space-x-2">
                  <button
                    onClick={resetSampleFormat}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Use Default Format
                  </button>
                  <button
                    onClick={clearSampleFormat}
                    className="text-xs text-gray-600 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <textarea
                value={sampleFormat}
                onChange={(e) => setSampleFormat(e.target.value)}
                rows="12"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                placeholder="Enter your desired JSON format sample..."
              />
              <p className="text-xs text-gray-500 mt-1">
                LLM will reorganize all data according to this format
              </p>
            </div>

            {/* Include Explanations Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeExplanations"
                checked={includeExplanations}
                onChange={(e) => setIncludeExplanations(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="includeExplanations" className="text-sm text-gray-700">
                Include scoring explanations (will increase file size)
              </label>
            </div>

            {/* Export Button */}
            <button
              onClick={handleLLMExport}
              disabled={isExporting || !apiKey.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting && llmExportMutation.isLoading ? 'AI Processing...' : 'Generate Formatted JSON'}
            </button>
          </div>
        </div>

        {/* Tips Section */}
        <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4">
          <h4 className="font-medium text-yellow-800 mb-2">Usage Tips</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Excel export contains all raw data, suitable for direct data analysis</li>
            <li>• AI formatted export can reorganize data structure according to your needs</li>
            <li>• API Key is only used in this session and will not be stored</li>
            <li>• If the data volume is large, AI processing may take some time</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 