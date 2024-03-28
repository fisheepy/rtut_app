import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Slider } from '@miblanchard/react-native-slider';
import { GiConfirmed } from "react-icons/gi";
import { GiCancel } from "react-icons/gi";

const SurveyRenderer = ({ surveyJson, onSurveyComplete, onCancel, windowDimensions }) => {
  const styles = StyleSheet.create({
    surveyContainer: {
      width: windowDimensions.width * 1,
      backgroundColor: '#d8dee6',
    },
    questionContainer: {
      marginBottom: 20,
      paddingHorizontal: 30,
      width: windowDimensions.width * 0.9,
    },
    questionTitle: {
      textAlign: 'center',
      marginBottom: 10,
    },
    choiceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      width: windowDimensions.width * 0.9,
    },
    radioCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#000',
      marginHorizontal: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectedRadio: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#000',
    },
    customInput: {
      borderWidth: 1,
      borderColor: '#ccc',
      padding: 10,
      borderRadius: 5,
      marginTop: 10,
    },
    input: {
      borderWidth: 1,
      borderColor: '#ccc',
      padding: 10,
      borderRadius: 5,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 1,
      borderColor: '#000',
      marginHorizontal: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkedBox: {
      width: 12,
      height: 12,
      backgroundColor: '#000',
    },
    sliderContainer: {
      width: windowDimensions.width * 0.9,
      backgroundColor: 'gray',
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      backgroundColor: '#d8dee6',
      width: windowDimensions.width * 1,
    },
    button: {
    },
  });

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
            <Text style={styles.questionTitle}>{question.title}:</Text>
            <TextInput
              style={styles.input}
              placeholder="Your answer"
              value={answers[question.name] || ''}
              onChangeText={(text) => handleInputChange(question.name, text)}
            />
          </>
        );

      case 'singleChoice':
        return (
          <>
            <Text style={styles.questionTitle}>{question.title}:</Text>
            {question.choices.map((choice, index) => (
              choice !== 'Other' && (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleRadioChange(question.name, choice)}
                  style={styles.choiceContainer}
                >
                  <View style={styles.radioCircle}>
                    {answers[question.name] === choice && <View style={styles.selectedRadio} />}
                  </View>
                  <Text>{choice}</Text>
                </TouchableOpacity>)
            ))}
            {question.allowCustomAnswer && (
              <>
                <TouchableOpacity
                  onPress={() => handleRadioChange(question.name, 'other')}
                  style={styles.choiceContainer}
                >
                  <View style={styles.radioCircle}>
                    {customAnswerSelected[question.name] && <View style={styles.selectedRadio} />}
                  </View>
                  <Text>Other (please specify)</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.customInput}
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
            <Text style={styles.questionTitle}>{question.title}:</Text>
            <Slider
              containerStyle={styles.sliderContainer}
              minimumValue={1}
              maximumValue={question.rateMax}
              step={1}
              onValueChange={(value) => handleInputChange(question.name, value)}
              value={answers[question.name] || question.rateMax / 2}
            />
            <Text>{answers[question.name] || question.rateMax / 2}</Text>
          </>
        );

      case 'multiChoice':
        return (
          <>
            <Text style={styles.questionTitle}>{question.title}:</Text>
            {question.choices.map((choice, index) => (
              choice !== 'Other' && (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleCheckboxChange(question.name, choice, !answers[question.name]?.includes(choice))}
                  style={styles.choiceContainer}
                >
                  <View style={styles.checkbox}>
                    {answers[question.name]?.includes(choice) && <View style={styles.checkedBox} />}
                  </View>
                  <Text>{choice}</Text>
                </TouchableOpacity>)
            ))}
            {question.allowCustomAnswer && (
              <>
                <TouchableOpacity
                  onPress={() => handleOtherCheckboxChange(question.name, !customAnswerSelected[question.name])}
                  style={styles.choiceContainer}
                >
                  <View style={styles.checkbox}>
                    {customAnswerSelected[question.name] && <View style={styles.checkedBox} />}
                  </View>
                  <Text>Other (please specify)</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.customInput}
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
      style={styles.surveyContainer}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      {surveyJson.elements.map((question, index) => (
        <View style={styles.questionContainer}>
          {renderQuestion(question)}
        </View>
      ))}
      <View
        style={styles.buttonContainer}
      >
        {isSurveyComplete ? (
          <Pressable onPress={()=>onSurveyComplete(answers)}>
            <GiConfirmed
              style={styles.button}
              fontSize={40}
              color='green'
            />
          </Pressable>
        ) : (
          <GiConfirmed
            style={{ ...styles.button, pointerEvents: "none" }}
            fontSize={40}
            color='gray'
          />
        )}
        <View style={{ width: 100 }} />
        <Pressable onPress={onCancel}>
          <GiCancel
            style={{ ...styles.button, pointerEvents: "none" }}
            fontSize={40}
          />
        </Pressable>
      </View>
    </ScrollView>
  );
};

export default SurveyRenderer;
