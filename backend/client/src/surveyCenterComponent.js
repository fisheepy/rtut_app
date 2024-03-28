import React, { useState, useContext } from 'react';
import axios from 'axios';
import './App.css';
import EmployeeSelectionComponent from './employeeSelectionComponent';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import SurveyRenderer from './surveyRenderer';
import {useWindowDimensions} from 'react-native';

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
    const windowDimensions = useWindowDimensions();

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

        // Reset allowCustomAnswer for the next question
        setAllowCustomAnswer(false);
        setAnswerChoices([]);
        setQuestionTitle("");
    }

    // Function to confirm sending surveys to employees
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
        setSurveyJson({ elements: [] });
    };

    return (
        <div>
            <h3>Execution Status</h3>
            <p className="execution-status">{executionStatus}</p>
            <div id="add-question-section">
                <h3>Customize Survey</h3>
                <div>
                    <div>
                        <input
                            type="text"
                            placeholder="Subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            style={{ marginBottom: '10px', width: '50vw' }} // Adjust width here
                        />
                        <input
                            type="text"
                            placeholder="Sender"
                            value={sender}
                            onChange={(e) => setSender(e.target.value)}
                            style={{ marginBottom: '10px', width: '50vw' }} // Adjust width here
                        />
                    </div>
                    <div>
                        <button
                            onClick={addQuestion}
                            style={{ width: '15vw' }}>
                            Add Question
                        </button>
                        <select
                            value={selectedQuestionType}
                            onChange={(e) => setSelectedQuestionType(e.target.value)}
                            style={{ width: '10vw' }}>
                            <option value="text">Text</option>
                            <option value="singleChoice">Single Choice</option>
                            <option value="rating">Rating</option>
                            <option value="multiChoice">Multiple Choice</option>
                            {/* Add other supported question types */}
                        </select>
                        <input
                            type="text"
                            placeholder="Enter question title"
                            value={questionTitle}
                            onChange={(e) => setQuestionTitle(e.target.value)}
                            style={{ width: '25vw' }}
                        />
                        {(selectedQuestionType === "singleChoice" || selectedQuestionType === "multiChoice") && (
                            <div>
                                <p>Enter answer choices (comma-separated):</p>
                                <input
                                    type="text"
                                    placeholder="Choice 1, Choice 2, ..."
                                    value={answerChoices.join(", ")}
                                    onChange={(e) => setAnswerChoices(e.target.value.split(",").map(choice => choice.trim()))}
                                    style={{ width: '25vw', marginBottom: '10px' }}
                                />
                                {(selectedQuestionType === "singleChoice" || selectedQuestionType === "multiChoice") && (
                                    <label>
                                        <input type="checkbox" onChange={(e) => setAllowCustomAnswer(e.target.checked)} />
                                        Allow custom answer
                                    </label>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <button onClick={confirmSendSurveys} style={{ marginTop: '10px' }}>Send Survey</button>
            </div>
            <div id="preview-section">
                <h3>Preview</h3>
                <SurveyRenderer 
                    surveyJson={surveyJson}
                    windowDimensions={{width: windowDimensions.width*0.5}}/>
            </div>
            <div>
                <hr />
                <EmployeeSelectionComponent />
                <hr />
            </div>
        </div>
    );
}

export default SurveyCenterComponent;
