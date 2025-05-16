import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "../screens/HomeScreen";
import SingleScreen from "../screens/SingleScreen";
import MultiScreen from "../screens/MultiScreen";

export type RootStackParamList = {
  Home: undefined;
  Single: undefined;
  Multi: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Single" component={SingleScreen} />
        <Stack.Screen name="Multi" component={MultiScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
