import React, { useMemo, useState } from 'react';
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
  buildCreateCompetitorOperations,
  buildUpdateCompetitorOperations,
  findExistingPeople,
  findExistingCompetitionEntries,
} from '../../utils/CompetitorManagement';
import { validateCompetitorRows } from '../../utils/CompetitorImport';
import {
  handleDatabaseError,
  showSuccess,
  showWarning,
} from '../../utils/ErrorHandler';

export default function UploadCompetitorsPageNew() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [competitors, setCompetitors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Validate the whole file up front so the preview shows exactly what will
  // be written and what will be skipped
  const rows = useMemo(() => validateCompetitorRows(competitors), [competitors]);
  const importableCount = rows.filter((row) => row.importable).length;
  const problemRows = rows.filter((row) => !row.importable);

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

    const importable = rows.filter((row) => row.importable);
    if (importable.length === 0) {
      setUploadStatus({
        type: 'error',
        message: 'No rows can be imported. Fix the problems listed below and try again.',
      });
      return;
    }

    setIsProcessing(true);
    setUploadStatus({ type: 'info', message: 'Importing competitors...' });

    try {
      const serviceNumbers = importable.map((row) => row.competitor.serviceNumber);
      const existingPeople = await findExistingPeople(serviceNumbers);
      const existingEntries = await findExistingCompetitionEntries(
        competitionId,
        serviceNumbers,
      );

      // Every row is written in one transaction, so a failure part-way
      // leaves the competition exactly as it was
      const operations = importable.flatMap(({ competitor }) =>
        existingPeople.has(competitor.serviceNumber)
          ? buildUpdateCompetitorOperations(
              competitor,
              competitor.serviceNumber,
              existingEntries.has(competitor.serviceNumber),
              competitionId,
            )
          : buildCreateCompetitorOperations(competitor, competitionId),
      );
      await window.api.transaction(operations);

      const updateCount = importable.filter((row) =>
        existingPeople.has(row.competitor.serviceNumber),
      ).length;
      const createCount = importable.length - updateCount;
      const skippedCount = rows.length - importable.length;
      const summary = `Imported ${createCount} new and updated ${updateCount} existing competitor(s)`;

      showSuccess(summary);
      if (skippedCount > 0) {
        setUploadStatus({
          type: 'info',
          message: `${summary}. ${skippedCount} row(s) were skipped, see the problems listed below.`,
        });
        showWarning(`${skippedCount} row(s) skipped`);
      } else {
        setUploadStatus({ type: 'success', message: summary });
        // Navigate back after a short delay
        setTimeout(() => {
          navigate(-1);
        }, 2000);
      }
    } catch (error) {
      handleDatabaseError('import competitors', error);
      setUploadStatus({
        type: 'error',
        message: `Import failed and nothing was written: ${error.message}`,
      });
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

            {rows.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">
                  Preview: {importableCount} ready to import
                  {problemRows.length > 0 && `, ${problemRows.length} with problems`}
                </h4>
                {problemRows.length > 0 && (
                  <div className="mb-3 p-3 bg-danger/10 border border-danger/20 rounded-md text-sm">
                    <p className="font-medium text-danger mb-1">These rows will be skipped:</p>
                    <ul className="list-disc list-inside text-neutral-700 space-y-0.5">
                      {problemRows.slice(0, 20).map((row) => (
                        <li key={row.rowNumber}>
                          Row {row.rowNumber}
                          {(row.competitor.firstName || row.competitor.lastName) &&
                            ` (${row.competitor.firstName} ${row.competitor.lastName})`}
                          : {row.problems.join('; ')}
                        </li>
                      ))}
                      {problemRows.length > 20 && (
                        <li>... and {problemRows.length - 20} more</li>
                      )}
                    </ul>
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto border rounded p-2 bg-neutral-50">
                  <ul className="text-sm space-y-1">
                    {rows.slice(0, 10).map((row) => (
                      <li key={row.rowNumber} className="text-neutral-700">
                        {row.competitor.firstName} {row.competitor.lastName}
                        {row.competitor.birthYear && ` (${row.competitor.birthYear})`}
                      </li>
                    ))}
                    {rows.length > 10 && (
                      <li className="text-neutral-500 italic">... and {rows.length - 10} more</li>
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
                disabled={!file || importableCount === 0 || isProcessing}
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
              <li>• <strong>gender</strong> or <strong>Gender</strong> (M/F, required)</li>
              <li>• <strong>serviceNumber</strong> or <strong>Service Number</strong> (required)</li>
              <li>• <strong>regiment</strong> or <strong>Regiment</strong> (unit name)</li>
              <li>• <strong>country</strong> or <strong>Country</strong> (GBR, USA, etc.)</li>
              <li>• <strong>title</strong> or <strong>Title</strong> (rank)</li>
              <li>• <strong>novice</strong> or <strong>Novice</strong> (Y/N)</li>
              <li>• <strong>reserve</strong> or <strong>Reserve</strong> (Y/N)</li>
              <li>• <strong>arrivalSeed</strong> or <strong>Arrival Seed</strong> (defaults to 2000)</li>
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
