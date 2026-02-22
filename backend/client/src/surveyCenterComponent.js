import React, { useState, useContext, useMemo } from 'react';
import axios from 'axios';
import './App.css';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import SurveyRenderer from './surveyRenderer';
import { useWindowDimensions } from 'react-native';
import { TextField, Button, Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel, Typography } from '@mui/material';
import BulkRecipientConfirmDialog from './bulkRecipientConfirmDialog';

function SurveyCenterComponent({ userData }) {
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

    const addQuestion = () => {
        let newQuestion;
        let choices = answerChoices.length > 0 ? answerChoices : ["Choice 1", "Choice 2"];
        if (allowCustomAnswer && (selectedQuestionType === "singleChoice" || selectedQuestionType === "multiChoice") && !choices.includes("Other")) {
            choices.push("Other");
        }

        switch (selectedQuestionType) {
            case "text":
                newQuestion = { name: `Question${surveyJson.elements.length + 1}`, title: questionTitle || "New Text Question", type: "text" };
                break;
            case "singleChoice":
                newQuestion = { name: `Question${surveyJson.elements.length + 1}`, title: questionTitle || "Select one option", type: "singleChoice", choices, allowCustomAnswer };
                break;
            case "multiChoice":
                newQuestion = { name: `Question${surveyJson.elements.length + 1}`, title: questionTitle || "Select multiple options", type: "multiChoice", choices, allowCustomAnswer };
                break;
            case "rating":
                newQuestion = { name: `Question${surveyJson.elements.length + 1}`, title: questionTitle || "Rate our service", type: "rating", rateMax: 5 };
                break;
            default:
                return;
        }

        setSurveyJson(prevSurveyJson => ({ ...prevSurveyJson, elements: [...prevSurveyJson.elements, newQuestion] }));
        setAllowCustomAnswer(false);
        setAnswerChoices([]);
        setQuestionTitle("");
    };

    const removeQuestion = (index) => {
        setSurveyJson(prevSurveyJson => ({ ...prevSurveyJson, elements: prevSurveyJson.elements.filter((_, i) => i !== index) }));
    };

    const confirmSendSurveys = async () => {
        const sendInBatches = async (employees, batchSize) => {
            const totalBatches = Math.ceil(employees.length / batchSize);
            const timeStamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

            for (let i = 0; i < totalBatches; i++) {
                const batch = employees.slice(i * batchSize, (i + 1) * batchSize);
                const batchData = {
                    subject,
                    sender,
                    surveyJson,
                    selectedEmployees: batch,
                    adminUser: {
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        email: userData.email,
                    },
                };

                try {
                    await axios.post('/call-function-send-survey', batchData);
                    setExecutionStatus(`Status:${timeStamp}:\tBatch ${i + 1} of ${totalBatches} sent successfully.`);
                } catch (error) {
                    setExecutionStatus(`Status:${timeStamp}:\tBatch ${i + 1} of ${totalBatches} failed! Error: ${error.message}`);
                }
            }
        };

        await sendInBatches(selectedEmployees, 100);
        setOpenConfirmDialog(false);
        setSurveyJson({ elements: [] });
    };

    return (
        <div>
            <Typography variant="h6">Execution Status</Typography>
            <Typography>{executionStatus}</Typography>
            <div>
                <Typography variant="h6">Customize Survey</Typography>
                <TextField label="Subject" variant="outlined" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: '25%' }} />
                <TextField label="Sender" variant="outlined" value={sender} onChange={(e) => setSender(e.target.value)} style={{ width: '25%' }} />
            </div>
            <div>
                <Button onClick={addQuestion} style={{ marginTop: '10px', marginBottom: '10px', width: '50%', color: 'white', backgroundColor: 'gray' }}>
                    Add Question
                </Button>
                <FormControl fullWidth>
                    <InputLabel>Question Type</InputLabel>
                    <Select value={selectedQuestionType} onChange={(e) => setSelectedQuestionType(e.target.value)} label="Question Type" style={{ marginTop: '10px', width: '50%' }}>
                        <MenuItem value="text">Text</MenuItem>
                        <MenuItem value="singleChoice">Single Choice</MenuItem>
                        <MenuItem value="rating">Rating</MenuItem>
                        <MenuItem value="multiChoice">Multiple Choice</MenuItem>
                    </Select>
                </FormControl>
                <TextField label="Enter question title" variant="outlined" value={questionTitle} onChange={(e) => setQuestionTitle(e.target.value)} style={{ marginTop: '10px', width: '50%' }} />
                {(selectedQuestionType === "singleChoice" || selectedQuestionType === "multiChoice") && (
                    <>
                        <TextField
                            label="Enter answer choices (comma-separated)"
                            variant="outlined"
                            value={answerChoices.join(", ")}
                            onChange={(e) => setAnswerChoices(e.target.value.split(",").map(choice => choice.trim()))}
                            style={{ marginTop: '10px', width: '50%' }}
                        />
                        <FormControlLabel control={<Checkbox checked={allowCustomAnswer} onChange={(e) => setAllowCustomAnswer(e.target.checked)} />} label="Allow custom answer" />
                    </>
                )}
            </div>
            <div>
                <Typography variant="h6">Preview</Typography>
                <SurveyRenderer surveyJson={surveyJson} onRemoveQuestion={removeQuestion} windowDimensions={{ width: windowDimensions.width * 0.5 }} />
            </div>
            <Button variant="contained" onClick={() => setOpenConfirmDialog(true)} style={{ marginTop: '10px', width: '50%' }}>
                Send Survey
            </Button>

            <BulkRecipientConfirmDialog
                open={openConfirmDialog}
                onClose={() => setOpenConfirmDialog(false)}
                onConfirm={confirmSendSurveys}
                title="Confirm Send Survey"
                instruction="Please confirm the exact employees below. Survey will be sent only to this list."
                confirmLabel="Confirm & Send Survey"
                emptyMessage="No employees are selected. Please select employees before sending survey."
                selectedEmployees={selectedEmployees}
                metadata={[
                    { label: 'Subject', value: subject },
                    { label: 'Sender', value: sender },
                    { label: 'Admin User', value: `${userData.firstName} ${userData.lastName}` },
                ]}
            />
        </div>
    );
}

export default SurveyCenterComponent;
