import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationModal from './notificationModal';
import { NotificationProvider } from './context/novuNotifications';
import UsefulLinksComponent from './usefulLinksComponent';
import UserSettingsComponent from './userSettingsComponent';
import { GrUserSettings, GrFormClose } from "react-icons/gr"; // Import GrFormClose for the Back icon
import { useSpring, animated } from 'react-spring';
import { useDrag } from '@use-gesture/react';
import commonStyles from './styles/commonStyles';

function App({ windowDimensions }) {
  const [subscriberId, setSubscriberId] = useState(null);
  const [subscriberName, setSubscriberName] = useState(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [style, api] = useSpring(() => ({ y: 0 }));
  const [isPulledDown, setIsPulledDown] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const bind = useDrag(({ down, movement: [mx, my] }) => {
    if (down) {
      api.start({ y: my });
    } else {
      api.start({ y: 0 });
      if (my > 100) { // Adjust threshold as needed
        setIsPulledDown(true); // Set the flag when pulled down
      }
    }
  }, { axis: 'y' });

  const dragStyle = {
    touchAction: 'none',
  };

  useEffect(() => {
    // Reset the flag after it has been set to true
    if (isPulledDown) {
      setTimeout(() => setIsPulledDown(false), 300); // Reset after some time
    }
  }, [isPulledDown]);

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
        <Pressable onPress={toggleMenu}>
          <GrUserSettings style={{ fontSize: 24, color: '#3273a8' }} />
        </Pressable>
      </View>
      {isMenuVisible && (
        <View style={commonStyles.app.menu}>
          <Pressable onPress={() => setIsMenuVisible(false)} style={commonStyles.app.backIcon}>
            <GrFormClose style={{ fontSize: 32, color: '#3273a8' }} />
          </Pressable>
          <UserSettingsComponent />
          <UsefulLinksComponent />
        </View>
      )}
      <View style={commonStyles.app.content}>
        <div>
          <animated.div {...bind()} style={{ ...dragStyle, y: style.y.to(y => Math.min(y, 150)) }}>
            <NotificationProvider applicationIdentifier="o-7dmY_XxQs5" subscriberId={subscriberId}>
              <NotificationModal windowDimensions={windowDimensions} isPulledDown={isPulledDown} />
            </NotificationProvider>
          </animated.div>
        </div>
      </View>
    </View>
  );
}

export default App;
