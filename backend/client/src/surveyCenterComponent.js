import React, { useState, useContext } from 'react';
import axios from 'axios';
import './App.css';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import SurveyRenderer from './surveyRenderer';
import { useWindowDimensions } from 'react-native';
import { TextField, Button, Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@mui/material';

function SurveyCenterComponent() {
    const [subject, setSubject] = useState('');
    const [sender, setSender] = useState('');
    const [surveyJson, setSurveyJson] = useState({ elements: [] });
    const [selectedQuestionType, setSelectedQuestionType] = useState("text");
    const [questionTitle, setQuestionTitle] = useState("");
    const { selectedEmployees } = useContext(SelectedEmployeesContext);
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const [answerChoices, setAnswerChoices] = useState([]);
    const [allowCustomAnswer, setAllowCustomAnswer] = useState(false);
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);

    const windowDimensions = useWindowDimensions();

    const prepareRecipientNames = () => {
        return selectedEmployees.map(emp => emp.Name).join('/ ');
    };

    function addQuestion() {
        let newQuestion;
        // Adjust choices based on whether a custom answer is allowed
        let choices = answerChoices.length > 0 ? answerChoices : ["Choice 1", "Choice 2"];
        if (allowCustomAnswer && (selectedQuestionType === "singleChoice" || selectedQuestionType === "multiChoice") && !choices.includes("Other")) {
            choices.push("Other"); // Add 'Other' option for custom answer
        }

        switch (selectedQuestionType) {
            case "text":
                newQuestion = {
                    name: `Question${surveyJson.elements.length + 1}`,
                    title: questionTitle || "New Text Question", // Use custom title or default
                    type: "text"
                };
                break;
            case "singleChoice":
                // Previously "checkbox", now allowing only one choice to be selected
                newQuestion = {
                    name: `Question${surveyJson.elements.length + 1}`,
                    title: questionTitle || "Select one option",
                    type: "singleChoice",
                    choices,
                    allowCustomAnswer
                };
                break;
            case "multiChoice":
                // New case for multiChoice where multiple answers can be selected
                newQuestion = {
                    name: `Question${surveyJson.elements.length + 1}`,
                    title: questionTitle || "Select multiple options",
                    type: "multiChoice",
                    choices,
                    allowCustomAnswer
                };
                break;
            case "rating":
                newQuestion = {
                    name: `Question${surveyJson.elements.length + 1}`,
                    title: questionTitle || "Rate our service",
                    type: "rating",
                    rateMax: 5,
                };
                break;
            default:
                console.error("Unsupported question type:", selectedQuestionType);
                return;
        }

        setSurveyJson(prevSurveyJson => ({
            ...prevSurveyJson,
            elements: [...prevSurveyJson.elements, newQuestion]
        }));
        console.log(surveyJson);
        // Reset allowCustomAnswer for the next question
        setAllowCustomAnswer(false);
        setAnswerChoices([]);
        setQuestionTitle("");
    }

    const handleSendSurvey = () => {
        setOpenConfirmDialog(true);
    };

    const confirmSendSurveys = () => {
        const data = { subject, sender, surveyJson, selectedEmployees };
        axios.post('/call-function-send-survey', data)
            .then(response => {
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(`Status:${timeStamp}:\tSend survey succeeded!`);
            })
            .catch(error => {
                const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
                setExecutionStatus(`Status:${timeStamp}:\tSend survey failed!`);
            });
        setOpenConfirmDialog(false); // Close the dialog after sending
        setSurveyJson({ elements: [] }); // Reset the survey after sending
    };

    return (
        <div>
            <Typography variant="h6">Execution Status</Typography>
            <Typography>{executionStatus}</Typography>
            <div>
                <Typography variant="h6">Customize Survey</Typography>
                <TextField
                    label="Subject"
                    variant="outlined"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{ width: '25%', }}
                />
                <TextField
                    label="Sender"
                    variant="outlined"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    style={{ width: '25%', }}
                />
            </div>
            <div>
                <Button onClick={addQuestion}
                    style={{ marginTop: '10px', marginBottom: '10px', width: '50%', color: 'white', backgroundColor: 'gray', }}>
                    Add Question
                </Button>
                <FormControl fullWidth >
                    <InputLabel >Question Type</InputLabel>
                    <Select
                        value={selectedQuestionType}
                        onChange={(e) => setSelectedQuestionType(e.target.value)}
                        label="Question Type"
                        style={{ marginTop: '10px', width: '50%', }}
                    >
                        <MenuItem value="text">Text</MenuItem>
                        <MenuItem value="singleChoice">Single Choice</MenuItem>
                        <MenuItem value="rating">Rating</MenuItem>
                        <MenuItem value="multiChoice">Multiple Choice</MenuItem>
                    </Select>
                </FormControl>
                <TextField
                    label="Enter question title"
                    variant="outlined"
                    value={questionTitle}
                    onChange={(e) => setQuestionTitle(e.target.value)}
                    style={{ marginTop: '10px', width: '50%', }}
                />
                {selectedQuestionType === "singleChoice" || selectedQuestionType === "multiChoice" ? (
                    <>
                        <TextField
                            label="Enter answer choices (comma-separated)"
                            variant="outlined"
                            value={answerChoices.join(", ")}
                            onChange={(e) => setAnswerChoices(e.target.value.split(",").map(choice => choice.trim()))}
                            style={{ marginTop: '10px', width: '50%', }}
                        />
                        <FormControlLabel
                            control={<Checkbox checked={allowCustomAnswer} onChange={(e) => setAllowCustomAnswer(e.target.checked)} />}
                            label="Allow custom answer"
                        />
                    </>
                ) : null}
            </div>
            <div>
                <Typography variant="h6">Preview</Typography>
                <SurveyRenderer surveyJson={surveyJson} windowDimensions={{ width: windowDimensions.width * 0.5 }} />
            </div>
            <Dialog open={openConfirmDialog} onClose={() => setOpenConfirmDialog(false)}>
                <DialogTitle>Confirm Send Survey</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to send this survey to the selected employees?
                    </DialogContentText>
                    <strong>Subject: {subject}</strong><br />
                    <strong>Sender: {sender}</strong><br />
                    <strong>Recipients:</strong> {prepareRecipientNames()}<br />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenConfirmDialog(false)}>Cancel</Button>
                    <Button onClick={confirmSendSurveys} color="primary">Send</Button>
                </DialogActions>
            </Dialog>
            <Button variant="contained" onClick={handleSendSurvey} style={{ marginTop: '10px', width: '50%' }}>
                Send Survey
            </Button>
        </div>
    );
}

export default SurveyCenterComponent;
