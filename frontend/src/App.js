import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationModal from './notificationModal';
import { NotificationProvider } from './context/novuNotifications';
import UsefulLinksComponent from './usefulLinksComponent';
import UserSettingsComponent from './userSettingsComponent';
import { GrUserSettings, GrFormClose } from "react-icons/gr"; // Import GrFormClose for the Back icon
import commonStyles from './styles/commonStyles';

function App({ windowDimensions }) {
  const [subscriberId, setSubscriberId] = useState(null);
  const [subscriberName, setSubscriberName] = useState(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function fetchUserDetails() {
      try {
        const userId = await AsyncStorage.getItem('userId');
        const userName = await AsyncStorage.getItem('userName');
        const [firstName, lastName] = userName.split('/');
        if (!isCancelled && userId && userName) {
          setSubscriberId(userId);
          setSubscriberName({ firstName, lastName }); // Assuming userName is stored as a stringified JSON
          console.log(userName);
          setIsDataLoaded(true); // Data is considered loaded when both states are set
        } else {
          setTimeout(fetchUserDetails, 5000); // Retry after 5 seconds if data is not yet available or complete
        }
      } catch (error) {
        console.error('Error fetching user details from AsyncStorage:', error);
        if (!isCancelled) {
          setTimeout(fetchUserDetails, 5000); // Retry after error
        }
      }
    }

    fetchUserDetails();

    return () => {
      isCancelled = true; // Prevent setting state after the component is unmounted
    };
  }, []);


  const toggleMenu = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  return (
    <View style={commonStyles.app.container}>
      <View style={commonStyles.app.banner}>
        {isDataLoaded ? (
          <Text style={commonStyles.app.bannerText}>Welcome Back, {subscriberName.firstName} {subscriberName.lastName} </Text>
        ) : (
          <Text style={commonStyles.app.bannerText}>Loading...</Text>
        )}      
        </View>
      <View style={commonStyles.app.iconButtonContainer}>
        <Pressable onPress={toggleMenu} style={commonStyles.app.settingIcon}>
          <GrUserSettings />
        </Pressable>
      </View>
      {isMenuVisible && (
        <View style={commonStyles.app.menu}>
          <Pressable onPress={() => setIsMenuVisible(false)} style={commonStyles.app.backIcon}>
            <GrFormClose />
          </Pressable>
          <UserSettingsComponent />
          <UsefulLinksComponent />
        </View>
      )}
      <View style={commonStyles.app.content}>
        <div>
            <NotificationProvider applicationIdentifier="o-7dmY_XxQs5" subscriberId={subscriberId}>
              <NotificationModal windowDimensions={windowDimensions} />
            </NotificationProvider>
        </div>
      </View>
    </View>
  );
}

export default App;
