import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import SurveyRenderer from './surveyRenderer';

const SurveysHistoryModule = () => {
  const [surveys, setSurveys] = useState([]);
  const [selectedSurveyJson, setSelectedSurveyJson] = useState({});
  const [surveyResults, setSurveyResults] = useState([]);
  const [isSurveyDialogOpen, setIsSurveyDialogOpen] = useState(false);
  const [isResultsDialogOpen, setIsResultsDialogOpen] = useState(false);

  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        const loginName = JSON.parse(localStorage.getItem('loginName'));
        const response = await axios.get(`/surveys?lastName=${loginName.lastName}&firstName=${loginName.firstName}`);
        const sortedNotifications = response.data.sort((a, b) => new Date(b.currentDataTime) - new Date(a.currentDataTime));
        setSurveys(sortedNotifications);
      } catch (error) {
        console.error('Error fetching surveys:', error);
      }
    };

    fetchSurveys();
  }, []);

  const handleOpenSurvey = (survey) => {
    setSelectedSurveyJson(JSON.parse(survey.surveyQuestionsJSON));
    setIsSurveyDialogOpen(true);
  };

  const handleCloseSurveyDialog = () => {
    setIsSurveyDialogOpen(false);
  };

  const handleViewResults = async (surveyId) => {
    try {
      const loginName = JSON.parse(localStorage.getItem('loginName'));
      const response = await axios.get(`/survey-results/${surveyId}?lastName=${loginName.lastName}&firstName=${loginName.firstName}`);
      setSurveyResults(response.data);
      console.log(response.data);
      setIsResultsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching survey results:', error);
    }
  };

  const handleCloseResultsDialog = () => {
    setIsResultsDialogOpen(false);
  };

  const renderAnswers = (answers) => {
    return Object.entries(answers).map(([question, answer]) => `${question}: ${answer}`).join(", ");
  };
  
  return (
    <div>
      <h2>Surveys History</h2>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Sender</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Send Timestamp</TableCell>
              <TableCell>View Survey</TableCell>
              <TableCell>View Results</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {surveys.map((survey) => (
              <TableRow key={survey._id}>
                <TableCell>{survey.sender}</TableCell>
                <TableCell>{survey.subject}</TableCell>
                <TableCell>{new Date(survey.currentDataTime).toLocaleString()}</TableCell>
                <TableCell>
                  <Button variant="outlined" onClick={() => handleOpenSurvey(survey)}>
                    View
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="outlined" onClick={() => handleViewResults(survey.uniqueId)}>
                    Results
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={isSurveyDialogOpen} onClose={handleCloseSurveyDialog} maxWidth="lg" fullWidth>
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
          <Button onClick={handleCloseSurveyDialog}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={isResultsDialogOpen} onClose={handleCloseResultsDialog} maxWidth="lg" fullWidth>
        <DialogTitle>Survey Results</DialogTitle>
        <DialogContent>
        <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Answers</TableCell>
                  <TableCell>Timestamp</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {surveyResults.map((result) => (
                  <TableRow key={result._id}>
                    <TableCell>{result._id}</TableCell>
                    <TableCell>{renderAnswers(result.answers)}</TableCell>
                    <TableCell>{new Date(result.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResultsDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default SurveysHistoryModule;
