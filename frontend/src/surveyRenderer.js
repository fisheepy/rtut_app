import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Slider } from '@miblanchard/react-native-slider';
import { GiConfirmed } from "react-icons/gi";
import { GiCancel } from "react-icons/gi";
import commonStyles from './styles/commonStyles';

const SurveyRenderer = ({ surveyJson, onSurveyComplete, onCancel, windowDimensions }) => {
  const initializeAnswers = (surveyQuestions) => {
    const initialAnswers = {};
    surveyQuestions.forEach(question => {
      if (question.type === "multiChoice" && question.allowCustomAnswer) {
        // Initialize the custom answer field
        initialAnswers[`${question.name}-custom`] = '';
      }
    });
    return initialAnswers;
  };

  // Usage
  const [answers, setAnswers] = useState(() => initializeAnswers(surveyJson.elements));
  const [isSurveyComplete, setIsSurveyComplete] = useState(false);
  const [customAnswerSelected, setCustomAnswerSelected] = useState({});

  useEffect(() => {
    const allAnswered = surveyJson.elements.every(question => answers.hasOwnProperty(question.name));
    setIsSurveyComplete(allAnswered);
  }, [answers, surveyJson.elements]);

  const handleRadioChange = (questionName, value) => {
    // Set the answer normally for predefined choices
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionName]: value,
    }));

    // Track whether the "Other" option was selected
    const isOtherSelected = value === "other";
    setCustomAnswerSelected(prevState => ({
      ...prevState,
      [questionName]: isOtherSelected,
    }));

    // If "Other" is not selected, clear any custom answer to reset the state
    if (!isOtherSelected) {
      setAnswers(prevAnswers => {
        const updatedAnswers = { ...prevAnswers };
        delete updatedAnswers[`${questionName}-custom`];
        return updatedAnswers;
      });
    }
  };

  const handleInputChange = (questionName, value) => {
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionName]: value,
    }));
  };

  const handleCustomAnswerChange = (questionName, value) => {
    // Update the custom answer
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [`${questionName}-custom`]: value,
    }));
    // Ensure "Other" checkbox is checked when typing in the custom answer field
    if (value !== '') {
      setCustomAnswerSelected(prevState => ({
        ...prevState,
        [questionName]: true,
      }));
    }
  };

  const handleCheckboxChange = (questionName, choice, isChecked) => {
    if (isChecked) {
      // Add the choice to the list of selected answers or set the custom answer
      if (choice !== 'other') {
        setAnswers(prevAnswers => ({
          ...prevAnswers,
          [questionName]: [...(prevAnswers[questionName] || []), choice],
        }));
      }
    } else {
      // Remove the choice from the list of selected answers if it's not 'other'
      setAnswers(prevAnswers => ({
        ...prevAnswers,
        [questionName]: prevAnswers[questionName]?.filter(item => item !== choice),
      }));
    }
  };

  const handleOtherCheckboxChange = (questionName, isChecked) => {
    // Handle toggle for the custom answer checkbox
    setCustomAnswerSelected(prevState => ({
      ...prevState,
      [questionName]: isChecked,
    }));

    if (isChecked) {
      // If "Other" is checked but no custom text is entered yet, initialize it
      if (!answers[`${questionName}-custom`]) {
        handleCustomAnswerChange(questionName, '');
      }
    } else {
      // Clear the custom answer if "Other" is deselected
      setAnswers(prevAnswers => {
        const updatedAnswers = { ...prevAnswers };
        delete updatedAnswers[`${questionName}-custom`];
        return updatedAnswers;
      });
    }
  };

  const renderQuestion = (question) => {
    switch (question?.type) {
      case 'text':
        return (
          <>
            <Text style={commonStyles.SurveyRenderer.title}>{question.title}:</Text>
            <TextInput
              style={commonStyles.SurveyRenderer.input}
              placeholder="Your answer"
              value={answers[question.name] || ''}
              onChangeText={(text) => handleInputChange(question.name, text)}
            />
          </>
        );

      case 'singleChoice':
        return (
          <>
            <Text style={commonStyles.SurveyRenderer.title}>{question.title}:</Text>
            {question.choices.map((choice, index) => (
              choice !== 'Other' && (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleRadioChange(question.name, choice)}
                  style={commonStyles.SurveyRenderer.choiceContainer}
                >
                  <View style={commonStyles.SurveyRenderer.radioCircle}>
                    {answers[question.name] === choice && <View style={commonStyles.SurveyRenderer.selectedRadio} />}
                  </View>
                  <Text style={commonStyles.SurveyRenderer.text}>{choice}</Text>
                </TouchableOpacity>)
            ))}
            {question.allowCustomAnswer && (
              <>
                <TouchableOpacity
                  onPress={() => handleRadioChange(question.name, 'other')}
                  style={commonStyles.SurveyRenderer.choiceContainer}
                >
                  <View style={commonStyles.SurveyRenderer.radioCircle}>
                    {customAnswerSelected[question.name] && <View style={commonStyles.SurveyRenderer.selectedRadio} />}
                  </View>
                  <Text style={commonStyles.SurveyRenderer.text}>Other (please specify)</Text>
                </TouchableOpacity>
                <TextInput
                  style={commonStyles.SurveyRenderer.input}
                  placeholder="Other (please specify)"
                  onChangeText={(text) => handleCustomAnswerChange(question.name, text)}
                  value={answers[`${question.name}-custom`] || ''}
                  editable={customAnswerSelected[question.name]}
                />
              </>
            )}
          </>
        );

      case 'rating':
        return (
          <>
            <Text style={commonStyles.SurveyRenderer.title}>{question.title}:</Text>
            <Slider
              containerStyle={commonStyles.SurveyRenderer.sliderContainer}
              minimumValue={1}
              maximumValue={question.rateMax}
              step={1}
              onValueChange={(value) => handleInputChange(question.name, value)}
              value={answers[question.name] || question.rateMax / 2}
            />
            <Text style={commonStyles.SurveyRenderer.text}>{answers[question.name] || question.rateMax / 2}</Text>
          </>
        );

      case 'multiChoice':
        return (
          <>
            <Text style={commonStyles.SurveyRenderer.title}>{question.title}:</Text>
            {question.choices.map((choice, index) => (
              choice !== 'Other' && (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleCheckboxChange(question.name, choice, !answers[question.name]?.includes(choice))}
                  style={commonStyles.SurveyRenderer.choiceContainer}
                >
                  <View style={commonStyles.SurveyRenderer.checkbox}>
                    {answers[question.name]?.includes(choice) && <View style={commonStyles.SurveyRenderer.checkedBox} />}
                  </View>
                  <Text style={commonStyles.SurveyRenderer.text}>{choice}</Text>
                </TouchableOpacity>)
            ))}
            {question.allowCustomAnswer && (
              <>
                <TouchableOpacity
                  onPress={() => handleOtherCheckboxChange(question.name, !customAnswerSelected[question.name])}
                  style={commonStyles.SurveyRenderer.choiceContainer}
                >
                  <View style={commonStyles.SurveyRenderer.checkbox}>
                    {customAnswerSelected[question.name] && <View style={commonStyles.SurveyRenderer.checkedBox} />}
                  </View>
                  <Text style={commonStyles.SurveyRenderer.text}>Other (please specify)</Text>
                </TouchableOpacity>
                <TextInput
                  style={commonStyles.SurveyRenderer.input}
                  placeholder="Other (please specify)"
                  onChangeText={(text) => handleCustomAnswerChange(question.name, text)}
                  value={answers[`${question.name}-custom`] || ''}
                  editable={customAnswerSelected[question.name]}
                />
              </>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <ScrollView
      style={commonStyles.SurveyRenderer.container}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      {surveyJson.elements.map((question, index) => (
        <View style={commonStyles.SurveyRenderer.questionContainer}>
          {renderQuestion(question)}
        </View>
      ))}
      <View
        style={commonStyles.SurveyRenderer.buttonContainer}
      >
        {isSurveyComplete ? (
          <Pressable onPress={()=>onSurveyComplete(answers)}>
            <GiConfirmed
              fontSize={40}
              color='green'
            />
          </Pressable>
        ) : (
          <GiConfirmed
            style={{ pointerEvents: "none" }}
            fontSize={40}
            color='gray'
          />
        )}
        <View style={{ width: 100 }} />
        <Pressable onPress={onCancel}>
          <GiCancel
            style={{ pointerEvents: "none" }}
            fontSize={40}
          />
        </Pressable>
      </View>
    </ScrollView>
  );
};

export default SurveyRenderer;
