import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

import App from './App';
import RegistrationForm from './registrationForm';

const Stack = createStackNavigator();
const AppNavigation = () => {
  const windowDimensions = useWindowDimensions();
  const [appDimensions, setAppDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setAppDimensions(windowDimensions);
  }, []); // Run only once on mount

  return (
    <View style={[styles.container, { width: appDimensions.width, height: appDimensions.height }]}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="RegistrationForm" headerMode="none">
          <Stack.Screen name="Main">
            {props => <App {...props} windowDimensions={appDimensions} />}
          </Stack.Screen>
          <Stack.Screen name="RegistrationForm">
            {props => <RegistrationForm {...props} windowDimensions={appDimensions} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'static',
  },
});

export default AppNavigation;
