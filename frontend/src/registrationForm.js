import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ImageBackground } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUniqueId } from './utils';
import commonStyles from './styles/commonStyles';

const backgroundImage = require('./assets/Dearborn-New-Sign-scaled-1.jpg');

const RegistrationForm = ({ navigation, windowDimensions }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const styles = {
    container: { ...commonStyles.login.container, width: windowDimensions.width, height: windowDimensions.height, },
    form: { ...commonStyles.login.form, width: windowDimensions.width * 0.75, },
    input: commonStyles.login.input,
    buttonContainer: { ...commonStyles.login.buttonContainer, width: windowDimensions.width * 0.75, },
    tabButton: { ...commonStyles.login.tabButton, width: windowDimensions.width * 0.25, },
    tabButtonText: commonStyles.login.tabButtonText,
    backgroundImage: commonStyles.login.backgroundImage,
  };


  const handleConfirm = async () => {
    // Generate UID using first and last name
    const userId = generateUniqueId(
      firstName.toUpperCase(),
      lastName.toUpperCase()
    );

    try {
      await AsyncStorage.setItem('userId', userId);
      const userName = firstName + '/' + lastName;
      await AsyncStorage.setItem('userName', userName);
      console.log(userName);
    } catch (error) {
      console.error('Error saving UID:', error);
    }

    // Navigate back to the main view
    navigation.navigate("Main");
  };

  return (
    <ImageBackground source={backgroundImage} style={styles.backgroundImage}>
      <View style={styles.container}>
        <View style={styles.form}>
          <TextInput
            placeholder="First Name"
            value={firstName}
            onChangeText={setFirstName}
            style={styles.input}
          />
          <TextInput
            placeholder="Last Name"
            value={lastName}
            onChangeText={setLastName}
            style={styles.input}
          />
          <View style={styles.buttonContainer}>
            <Pressable
              style={styles.tabButton}
              title="Confirm"
              onPress={handleConfirm}>
              <Text style={styles.tabButtonText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
};

export default RegistrationForm;
