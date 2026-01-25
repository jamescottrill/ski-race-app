import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import {
  Upload,
  ArrowLeft,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import {
  createCompetitor,
  competitorExists,
  updateCompetitor,
  personExists,
} from '../../utils/CompetitorManagement';
import {
  handleDatabaseError,
  showSuccess,
  showWarning,
} from '../../utils/ErrorHandler';
import { v4 as uuid4 } from 'uuid';

export default function UploadCompetitorsPageNew() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setUploadStatus(null);
    setCompetitors([]);

    // Parse CSV immediately to show preview
    if (selectedFile) {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setCompetitors(results.data);
            setUploadStatus({
              type: 'info',
              message: `${results.data.length} competitor(s) ready to import`,
            });
          } else {
            setUploadStatus({
              type: 'error',
              message: 'No valid data found in CSV file',
            });
          }
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          setUploadStatus({
            type: 'error',
            message: `Failed to parse CSV file: ${error.message}`,
          });
        },
      });
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        firstName: 'John',
        lastName: 'Smith',
        birthYear: '1995',
        gender: 'M',
        serviceNumber: '12345678',
        regiment: '32 Regt RA',
        country: 'GBR',
        title: 'Capt',
        novice: 'Y',
        reserve: 'N',
        arrivalSeed: '179',
      },
      {
        firstName: 'Jane',
        lastName: 'Doe',
        birthYear: '1998',
        gender: 'F',
        serviceNumber: '87654321',
        regiment: '7 Para RHA',
        country: 'GBR',
        title: 'Lt',
        novice: 'N',
        reserve: 'N',
        arrivalSeed: '320',
      },
      {
        firstName: 'Robert',
        lastName: 'Johnson',
        birthYear: '1992',
        gender: 'M',
        serviceNumber: '11223344',
        regiment: 'Honourable Artillery Company',
        country: 'GBR',
        title: 'LSgt',
        novice: 'N',
        reserve: 'Y',
        arrivalSeed: '2',
      },
    ];

    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'competitor_import_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus({ type: 'error', message: 'Please select a file' });
      return;
    }

    if (competitors.length === 0) {
      setUploadStatus({ type: 'error', message: 'No competitors found in file' });
      return;
    }

    setIsProcessing(true);
    setUploadStatus({ type: 'info', message: 'Importing competitors...' });

    let successCount = 0;
    let errorCount = 0;
    let updateCount = 0;

    try {
      for (const competitor of competitors) {
        // Map CSV columns to formData structure
        const formData = {
          firstName: competitor.firstName || competitor['First Name'] || '',
          lastName: competitor.lastName || competitor['Last Name'] || '',
          title: competitor.title || competitor.Title || '',
          birthYear:
            competitor.birthYear ||
            competitor['Birth Year'] ||
            competitor.yearOfBirth ||
            '',
          country: competitor.country || competitor.Country || 'GBR',
          serviceNumber: competitor.serviceNumber || competitor['Service Number'] || '',
          gender: (competitor.gender || competitor.Gender || 'M').toUpperCase(),
          regiment:
            competitor.regiment ||
            competitor.Regiment ||
            competitor.unit ||
            competitor.Unit ||
            '',
          arrivalSeed: competitor.arrivalSeed || competitor['Arrival Seed'] || 2000,
          isNovice: (competitor.novice || competitor.Novice || 'N').toUpperCase() === 'Y',
          isReserve: (competitor.reserve || competitor.Reserve || 'N').toUpperCase() === 'Y',
          isFemale:
            (competitor.gender || competitor.Gender || 'M').toUpperCase() ===
            'F',
        };

        if (!formData.firstName || !formData.lastName) {
          console.warn('Skipping competitor with missing name:', competitor);
          errorCount++;
          continue;
        }
        if (!formData.serviceNumber) {
          formData.serviceNumber = uuid4();
          // console.warn('Skipping competitor with missing Service Number:', competitor);
          // errorCount++;
          // continue;
        }

        try {
          // Check if competitor exists
          const [cExists] = await competitorExists(formData.serviceNumber, competitionId);
          const [pExists, personId] = await personExists(formData.serviceNumber);
          if (pExists) {
            // Update existing competitor
            await updateCompetitor(formData, personId, cExists, competitionId);
            updateCount++;
          } else {
            // Create new competitor
            const result = await createCompetitor(formData, competitionId);
            if (!result.success) {
              throw new Error(result.error);
            }
            successCount++;
          }
        } catch (error) {
          console.error('Failed to import competitor:', formData.firstName, formData.lastName, error);
          errorCount++;
        }
      }

      // Show results
      if (errorCount === 0) {
        setUploadStatus({
          type: 'success',
          message: `Successfully imported ${successCount} new and updated ${updateCount} existing competitor(s)!`
        });
        showSuccess(`Imported ${successCount + updateCount} competitor(s)`);

        // Navigate back after a short delay
        setTimeout(() => {
          navigate(-1);
        }, 2000);
      } else {
        setUploadStatus({
          type: 'error',
          message: `Imported ${successCount + updateCount} competitor(s) with ${errorCount} error(s)`
        });
        showWarning(`${errorCount} competitor(s) failed to import`);
      }
    } catch (error) {
      handleDatabaseError('import competitors', error);
      setUploadStatus({ type: 'error', message: 'Failed to import competitors: ' + error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Upload Competitors"
        subtitle="Import competitors from CSV file"
        actions={
          <Button
            variant="outline"
            onClick={handleBack}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
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
              <label
                htmlFor="file-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg bg-primary-700 hover:bg-primary-500 cursor-pointer transition-colors"
              >
                <FileText className="w-4 h-4" />
                Choose File
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

            {competitors.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">Preview ({competitors.length} competitor{competitors.length !== 1 ? 's' : ''})</h4>
                <div className="max-h-48 overflow-y-auto border rounded p-2 bg-neutral-50">
                  <ul className="text-sm space-y-1">
                    {competitors.slice(0, 10).map((comp, idx) => (
                      <li key={idx} className="text-neutral-700">
                        {comp.firstName || comp['First Name']} {comp.lastName || comp['Last Name']}
                        {(comp.birthYear || comp['Birth Year']) && ` (${comp.birthYear || comp['Birth Year']})`}
                      </li>
                    ))}
                    {competitors.length > 10 && (
                      <li className="text-neutral-500 italic">... and {competitors.length - 10} more</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={handleBack} disabled={isProcessing}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpload}
                leftIcon={<Upload className="w-4 h-4" />}
                disabled={!file || competitors.length === 0 || isProcessing}
              >
                {isProcessing ? 'Importing...' : 'Import Competitors'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent>
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold">CSV Format</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSample}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download Sample
              </Button>
            </div>
            <p className="text-sm text-neutral-600 mb-3">
              Your CSV file should include the following columns:
            </p>
            <ul className="text-sm space-y-1 text-neutral-600">
              <li>• <strong>firstName</strong> or <strong>First Name</strong> (required)</li>
              <li>• <strong>lastName</strong> or <strong>Last Name</strong> (required)</li>
              <li>• <strong>birthYear</strong> or <strong>Birth Year</strong> (YYYY format)</li>
              <li>• <strong>gender</strong> or <strong>Gender</strong> (M/F)</li>
              <li>• <strong>serviceNumber</strong> or <strong>Service Number</strong></li>
              <li>• <strong>regiment</strong> or <strong>Regiment</strong> (unit name)</li>
              <li>• <strong>country</strong> or <strong>Country</strong> (GBR, USA, etc.)</li>
              <li>• <strong>title</strong> or <strong>Title</strong> (rank)</li>
              <li>• <strong>novice</strong> or <strong>Novice</strong> (Y/N)</li>
              <li>• <strong>reserve</strong> or <strong>Reserve</strong> (Y/N)</li>
            </ul>
            <p className="text-xs text-neutral-500 mt-3">
              Note: Column names are case-insensitive and can use either camelCase or Title Case with spaces.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
