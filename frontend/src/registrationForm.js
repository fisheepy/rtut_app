import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ImageBackground } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUniqueId } from './utils';

const backgroundImage = require('./assets/Dearborn-New-Sign-scaled-1.jpg');

const RegistrationForm = ({ navigation, windowDimensions }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: windowDimensions.width,
      height: windowDimensions.height,
      backgroundColor: 'transparent',
    },
    form: {
      minHeight: '100vw',
      width: windowDimensions.width * 0.75,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    input: {
      marginBottom: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 5,
      textAlign: 'center',
      width: '100%',
      backgroundColor: 'gray',
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 20,
      width: windowDimensions.width * 0.75,
    },
    tabButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      width: windowDimensions.width * 0.25,
      backgroundColor: '#839c83'
    },
    tabButtonText: {
    },
    backgroundImage: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
  });

  const handleConfirm = async () => {
    // Generate UID using first and last name
    const uid = generateUniqueId(
      firstName.toUpperCase(),
      lastName.toUpperCase()
    );

    try {
      // Save the UID to AsyncStorage
      await AsyncStorage.setItem('uid', uid);
    } catch (error) {
      console.error('Error saving UID:', error);
    }

    // Navigate back to the main view
    navigation.navigate("Main");
  };

  const handleCancel = () => {
    // Navigate back to the main view without saving any changes
    navigation.goBack();
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
            <Pressable
              style={styles.tabButton}
              title="Cancel"
              onPress={handleCancel}>
              <Text style={styles.tabButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
};

export default RegistrationForm;
