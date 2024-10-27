import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
} from '@mui/material';
import { fetchSeedList } from '../../utils/FetchSeedList';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { useBackButton } from '../../utils/navigation';

pdfMake.vfs = pdfFonts.pdfMake.vfs;

export default function SeedListPage() {
  const [seedList, setSeedList] = useState([]);
  const { competitionId } = useParams();
  const handleBack = useBackButton();

  useEffect(() => {
    const fetchList = async () => {
      const data = await fetchSeedList(competitionId);
      setSeedList(data);
    };
    fetchList();
  }, [competitionId]);

  const generatePDF = () => {

    const docDefinition = {
      content: [
        { text: 'Seed List', style: 'header' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', 'auto', 'auto'],
            body: [
              [
                { text: 'Position', style: 'tableHeader' },
                { text: 'Rank', style: 'tableHeader' },
                { text: 'Name', style: 'tableHeader' },
                { text: 'Team', style: 'tableHeader' },
                { text: 'Points', style: 'tableHeader' },
              ],
              ...(seedList || []).map((competitor, index) => [
                index + 1,
                competitor.title,
                `${competitor.first_name} ${competitor.last_name}`,
                competitor.team_name,
                competitor.seed_points,
              ]),
            ],
          },
        },
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 20],
        },
        tableHeader: {
          bold: true,
        },
      },
    };
    const pdfDoc = pdfMake.createPdf(docDefinition);
    // Use Electron's dialog to choose save location
    pdfDoc.getBuffer((buffer) => {
      window.electronAPI
        .savePDF(buffer)
        .then((filePath) => {
          if (filePath) {
            console.log('PDF saved successfully to:', filePath);
          } else {
            console.log('PDF save cancelled.');
          }
        })
        .catch((err) => {
          console.error('Error saving PDF:', err);
        });
    });
  };

  return (
    <Container className="seed-list-page flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Paper elevation={3} className="p-8 rounded-lg shadow-lg w-full max-w-lg">
        <Button variant="contained" onClick={handleBack}>
          Back
        </Button>
        <Typography
          variant="h4"
          component="h1"
          className="mb-6 text-gray-800 font-bold text-center"
        >
          Seed List
        </Typography>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center">Position</TableCell>
                <TableCell align="center">Rank</TableCell>
                <TableCell align="center">Name</TableCell>
                <TableCell align="center">Team</TableCell>
                <TableCell align="center">Points</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {seedList.map((competitor, index) => (
                <TableRow key={competitor.id}>
                  <TableCell align="center">{index + 1}</TableCell>
                  <TableCell align="left">{competitor.title}</TableCell>
                  <TableCell align="left">{`${competitor.first_name} ${competitor.last_name}`}</TableCell>
                  <TableCell align="left">{competitor.team_name}</TableCell>
                  <TableCell align="center">
                    {`${competitor.seed_points}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <div className="mt-4 flex justify-center space-x-4">
          <Button variant="contained" onClick={generatePDF}>
            Download PDF
          </Button>
        </div>
        <Button variant="contained" onClick={handleBack}>
          Back
        </Button>
      </Paper>
    </Container>
  );
}
