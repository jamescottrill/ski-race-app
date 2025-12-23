import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Upload,
  ArrowLeft,
  FileSpreadsheet,
  Check,
  AlertCircle,
  X
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  Card,
  CardContent,
  Button,
  TextField,
  DataTable,
  Badge,
  cn
} from '../../design-system';
import { useBackButton } from '../../utils/navigation';
import { importAASLEntries } from '../../utils/AASLManagement';
import toast from 'react-hot-toast';

export default function ImportAASLPage() {
  const navigate = useNavigate();
  const handleBack = useBackButton();
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [season, setSeason] = useState(new Date().getFullYear().toString());
  const [importing, setImporting] = useState(false);
  const [columnMapping, setColumnMapping] = useState({
    serviceNumber: '',
    firstName: '',
    lastName: '',
    gender: '',
    category: '',
    seedPoints: ''
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseExcelFile(selectedFile);
    }
  };

  const parseExcelFile = async (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length > 0) {
          const headerRow = jsonData[0];
          setHeaders(headerRow);
          autoDetectColumns(headerRow);

          const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== null && cell !== ''));
          setParsedData(dataRows);
        }
      } catch (error) {
        console.error('Failed to parse Excel file:', error);
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const autoDetectColumns = (headers) => {
    const mapping = { ...columnMapping };
    const lowerHeaders = headers.map(h => String(h).toLowerCase());

    lowerHeaders.forEach((header, index) => {
      const originalHeader = headers[index];
      if (header.includes('service') || header.includes('number') || header.includes('id')) {
        mapping.serviceNumber = originalHeader;
      }
      if (header.includes('first') || header === 'forename') {
        mapping.firstName = originalHeader;
      }
      if (header.includes('last') || header.includes('surname') || header === 'name') {
        mapping.lastName = originalHeader;
      }
      if (header.includes('gender') || header.includes('sex')) {
        mapping.gender = originalHeader;
      }
      if (header.includes('category') || header.includes('cat')) {
        mapping.category = originalHeader;
      }
      if (header.includes('seed') || header.includes('point') || header.includes('aasl')) {
        mapping.seedPoints = originalHeader;
      }
    });

    setColumnMapping(mapping);
  };

  const handleMappingChange = (field, value) => {
    setColumnMapping(prev => ({ ...prev, [field]: value }));
  };

  const getMappedData = () => {
    return parsedData.map((row, index) => {
      const getColumnValue = (column) => {
        const colIndex = headers.indexOf(column);
        return colIndex >= 0 ? row[colIndex] : '';
      };

      return {
        rowIndex: index,
        serviceNumber: String(getColumnValue(columnMapping.serviceNumber) || '').trim(),
        firstName: String(getColumnValue(columnMapping.firstName) || '').trim(),
        lastName: String(getColumnValue(columnMapping.lastName) || '').trim(),
        gender: String(getColumnValue(columnMapping.gender) || '').trim().toUpperCase().charAt(0),
        category: String(getColumnValue(columnMapping.category) || '').trim(),
        seedPoints: parseFloat(getColumnValue(columnMapping.seedPoints)) || 0,
        isValid: !!getColumnValue(columnMapping.serviceNumber) && !!getColumnValue(columnMapping.seedPoints)
      };
    });
  };

  const handleImport = async () => {
    const mappedData = getMappedData();
    const validData = mappedData.filter(row => row.isValid);

    if (validData.length === 0) {
      toast.error('No valid entries to import');
      return;
    }

    setImporting(true);
    try {
      const result = await importAASLEntries(validData, season);

      if (result.success) {
        toast.success(`Imported ${result.successCount} new entries, updated ${result.updateCount} existing`);
        navigate('/aasl');
      } else {
        toast.error(`Import completed with ${result.errorCount} errors`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const previewData = getMappedData();
  const validCount = previewData.filter(r => r.isValid).length;
  const invalidCount = previewData.filter(r => !r.isValid).length;

  const columns = [
    {
      header: 'Valid',
      accessorKey: 'isValid',
      cell: ({ row }) => (
        row.original.isValid
          ? <Check className="w-4 h-4 text-success-600" />
          : <X className="w-4 h-4 text-danger-600" />
      )
    },
    { header: 'Service Number', accessorKey: 'serviceNumber' },
    { header: 'First Name', accessorKey: 'firstName' },
    { header: 'Last Name', accessorKey: 'lastName' },
    { header: 'Gender', accessorKey: 'gender' },
    { header: 'Category', accessorKey: 'category' },
    {
      header: 'Seed Points',
      accessorKey: 'seedPoints',
      cell: ({ row }) => row.original.seedPoints.toFixed(2)
    }
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Import AASL"
        subtitle="Import Army Alpine Seed List from Excel"
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

      <div className="space-y-6">
        {/* Step 1: Upload File */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Step 1: Upload Excel File</h3>
            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
              <FileSpreadsheet className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer text-primary-600 hover:text-primary-700 font-medium"
              >
                Choose a file
              </label>
              <span className="text-neutral-600"> or drag and drop</span>
              <p className="text-sm text-neutral-500 mt-2">Excel files (.xlsx, .xls) or CSV</p>
              {file && (
                <p className="mt-4 text-sm text-success-600 font-medium">
                  Selected: {file.name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Configure Mapping */}
        {parsedData.length > 0 && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Step 2: Configure Column Mapping</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Season</label>
                  <TextField
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="e.g., 2024"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries({
                  serviceNumber: 'Service Number *',
                  firstName: 'First Name',
                  lastName: 'Last Name',
                  gender: 'Gender',
                  category: 'Category',
                  seedPoints: 'Seed Points *'
                }).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      {label}
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm"
                      value={columnMapping[key]}
                      onChange={(e) => handleMappingChange(key, e.target.value)}
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((header, idx) => (
                        <option key={idx} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preview */}
        {previewData.length > 0 && (
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-neutral-900">Step 3: Preview & Import</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="success">{validCount} valid</Badge>
                  {invalidCount > 0 && (
                    <Badge variant="danger">{invalidCount} invalid</Badge>
                  )}
                </div>
              </div>

              <DataTable
                data={previewData.slice(0, 10)}
                columns={columns}
              />

              {previewData.length > 10 && (
                <p className="text-sm text-neutral-600 mt-2">
                  Showing 10 of {previewData.length} rows
                </p>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={handleBack}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={validCount === 0 || importing}
                  leftIcon={<Upload className="w-4 h-4" />}
                >
                  {importing ? 'Importing...' : `Import ${validCount} Entries`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
