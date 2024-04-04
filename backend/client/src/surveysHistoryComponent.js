import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import SurveyRenderer from './surveyRenderer';

const SurveysHistoryModule = () => {
  const [surveys, setSurveys] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSurveyJson, setSelectedSurveyJson] = useState(null);

  // Function to handle viewing survey details (already implemented)
  const handleOpenSurvey = (surveyJson) => {
    setSelectedSurveyJson(surveyJson);
    setIsDialogOpen(true);
  };

  // Function to handle viewing survey results (to be designed)
  const handleViewResults = (surveyId) => {
    // Placeholder for handling view results action
    console.log("View results for survey ID:", surveyId);
    // You can set state here to open a dialog similar to the survey details or navigate to a different component/module
  };

  const handleClose = () => {
    setIsDialogOpen(false);
  };

  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        const loginName = { firstName: 'Xuan', lastName: 'Yu' };
        const response = await axios.get(`/surveys?lastName=${loginName.lastName}&firstName=${loginName.firstName}`);
        setSurveys(response.data);
      } catch (error) {
        console.error('Error fetching surveys:', error);
      }
    };

    fetchSurveys();
  }, []);

  return (
    <div>
      <h2>Surveys</h2>
      <TableContainer component={Paper}>
        <Table aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Sender</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Send Timestamp</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Results</TableCell> {/* New column for results */}
            </TableRow>
          </TableHead>
          <TableBody>
            {surveys.map((survey) => (
              <TableRow key={survey._id}>
                <TableCell>{survey.sender}</TableCell>
                <TableCell>{survey.subject}</TableCell>
                <TableCell>{new Date(survey.currentDataTime).toLocaleString()}</TableCell>
                <TableCell>
                  <Button variant="outlined" onClick={() => handleOpenSurvey(JSON.parse(survey.surveyQuestionsJSON))}>
                    View Survey
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="outlined" color="primary" onClick={() => handleViewResults(survey._id)}>
                    View Results
                  </Button> {/* New button for viewing results */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Survey details dialog (already implemented) */}
      <Dialog open={isDialogOpen} onClose={handleClose} maxWidth="lg" fullWidth>
        <DialogTitle>Survey Details</DialogTitle>
        <DialogContent>
          {selectedSurveyJson && (
            <SurveyRenderer
              surveyJson={selectedSurveyJson}
              windowDimensions={{ width: 600 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Go Back</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default SurveysHistoryModule;
