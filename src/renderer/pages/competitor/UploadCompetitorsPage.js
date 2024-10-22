import React, { useState } from 'react';
import Papa from 'papaparse';
import { Button, Typography, Container, Box, Paper, Grid } from '@mui/material';
import { createCompetitor, competitorExists, updateCompetitor } from '../../utils/CompetitorManagement';
import { useParams, useNavigate } from 'react-router-dom';


function UploadCompetitorsPage() {
  const [competitors, setCompetitors] = useState([]);
  const [file, setFile] = useState(null);
  const { competitionId } = useParams();

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

const navigate = useNavigate();

  const handleUpload = () => {
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCompetitors(results.data);
        },
        error: (error) => {
          console.error('Error parsing CSV', error);
        },
      });
    }
  };

  const handleConfirmUpload = async () => {
    for (const i in competitors) {
      const exists = await competitorExists(competitors[i].serviceNumber);
      if (exists){
        updateCompetitor(competitors[i], false, competitionId)
      } else {
        await createCompetitor(competitors[i], competitionId);
      }
    }
    window.alert("Competitors imported successfully.");
    navigate(-1);
  };

  return (
    <Container className="competitor-management-page flex flex-col items-center justify-center min-h-screen  w-full max-w-full">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-lg">
        <Typography
          variant="h4"
          component="h2"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Bulk Upload Competitors
        </Typography>
        <input type="file" accept=".csv" onChange={handleFileChange} />
        <Button
          variant="contained"
          color="primary"
          onClick={handleUpload}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full"
        >
          Upload
        </Button>
        <div>
          <h2>Uploaded Competitors</h2>
          <ul>
            {competitors.map((competitor, index) => (
              <li
                key={index}
              >{`${competitor.firstName} ${competitor.lastName}  - ${competitor.title} - ${competitor.dob}`}</li>
            ))}
          </ul>
        </div>
        <Button
          variant="contained"
          color="primary"
          onClick={handleConfirmUpload}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow-lg w-full"
        >
          Confirm
        </Button>
      </Paper>
    </Container>
  );
}

export default UploadCompetitorsPage;
