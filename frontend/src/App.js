import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationModal from './notificationModal';
import { NotificationProvider } from './context/novuNotifications';
import UsefulLinksComponent from './usefulLinksComponent';
import UserSettingsComponent from './userSettingsComponent';
import { GrUserSettings, GrFormClose } from "react-icons/gr"; // Import GrFormClose for the Back icon
import { useSpring, animated } from 'react-spring';
import { useDrag } from '@use-gesture/react';

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

  const bannerHeight = 100;
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'center',
      width: windowDimensions.width,
      height: windowDimensions.height,
      backgroundColor: '#d8dee6',
    },
    iconButtonContainer: {
      position: 'absolute',
      top: 50,
      left: 10,
      zIndex: 1, // Ensure the icon is above other content
    },
    menu: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: windowDimensions.width * 0.75,
      height: windowDimensions.height,
      backgroundColor: '#dddddd',
      padding: 10,
      zIndex: 2,
      alignItems: 'center', // Center content in the menu
      justifyContent: 'flex-start',
    },
    backIcon: {
      alignSelf: 'center', // Center the back icon
      marginTop: 50,
      marginBottom: 20, // Space below the back icon
      padding: 20,
    },
    content: {
      flex: 1,
      paddingTop: bannerHeight,
    },
    banner: {
      backgroundColor: '#6e909c', // Change this to any color you prefer for the banner background
      width: '100%', // Match the width of the screen
      height: bannerHeight, // Fixed height for the banner section
      justifyContent: 'center', // Center content vertically within the banner
      alignItems: 'center', // Center content horizontally within the banner
      position: 'absolute', // Position absolute to ensure it does not affect layout flow
      top: 0, // Align to the top of the screen
      zIndex: 0, // Ensure it's behind the menu and other content
    },
    bannerText: {
      color: 'white', // Text color for the banner
      fontSize: 20, // Adjust the font size as needed
    },
    // Adjust other styles as needed
  });

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        {isDataLoaded ? (
          <Text style={styles.bannerText}>Welcome Back, {subscriberName.firstName} {subscriberName.lastName} </Text>
        ) : (
          <Text style={styles.bannerText}>Loading...</Text>
        )}      </View>
      <View style={styles.iconButtonContainer}>
        <Pressable onPress={toggleMenu}>
          <GrUserSettings style={{ fontSize: 24, color: '#3273a8' }} />
        </Pressable>
      </View>
      {isMenuVisible && (
        <View style={styles.menu}>
          <Pressable onPress={() => setIsMenuVisible(false)} style={styles.backIcon}>
            <GrFormClose style={{ fontSize: 32, color: '#3273a8' }} />
          </Pressable>
          <UserSettingsComponent />
          <UsefulLinksComponent />
        </View>
      )}
      <View style={styles.content}>
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
