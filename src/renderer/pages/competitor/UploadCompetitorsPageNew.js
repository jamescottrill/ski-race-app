import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Upload, 
  ArrowLeft,
  FileText,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { 
  PageContainer, 
  PageHeader,
  Card,
  CardContent,
  Button
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';

export default function UploadCompetitorsPageNew() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setUploadStatus(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus({ type: 'error', message: 'Please select a file' });
      return;
    }

    setUploadStatus({ type: 'info', message: 'Processing file...' });
    
    // In a real implementation, parse CSV and insert competitors
    setTimeout(() => {
      setUploadStatus({ type: 'success', message: 'Successfully imported competitors!' });
    }, 2000);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Upload Competitors"
        subtitle="Import competitors from CSV file"
        actions={
          <Button variant="outline" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>
        }
      />
      
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent>
            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
              <p className="text-sm text-neutral-600 mb-4">
                Select a CSV file containing competitor information
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button as="span" variant="primary" leftIcon={<FileText className="w-4 h-4" />}>
                  Choose File
                </Button>
              </label>
              {file && (
                <p className="mt-4 text-sm">
                  Selected: <span className="font-medium">{file.name}</span>
                </p>
              )}
            </div>
            
            {uploadStatus && (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                uploadStatus.type === 'success' ? 'bg-success/10 text-success' :
                uploadStatus.type === 'error' ? 'bg-danger/10 text-danger' :
                'bg-info/10 text-info'
              }`}>
                {uploadStatus.type === 'success' && <CheckCircle className="w-5 h-5" />}
                {uploadStatus.type === 'error' && <AlertCircle className="w-5 h-5" />}
                <span>{uploadStatus.message}</span>
              </div>
            )}
            
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={handleBack}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleUpload} leftIcon={<Upload className="w-4 h-4" />}>
                Upload
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mt-6">
          <CardContent>
            <h3 className="font-semibold mb-3">CSV Format</h3>
            <p className="text-sm text-neutral-600 mb-3">
              Your CSV file should include the following columns:
            </p>
            <ul className="text-sm space-y-1 text-neutral-600">
              <li>• First Name</li>
              <li>• Last Name</li>
              <li>• Date of Birth (YYYY-MM-DD)</li>
              <li>• Gender (M/F)</li>
              <li>• Service Number</li>
              <li>• Regiment/Unit</li>
              <li>• Country Code (GBR, USA, etc.)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}