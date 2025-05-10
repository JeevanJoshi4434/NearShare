import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MainScreen from './screens/MainScreen.tsx';
import MessageScreen from './screens/MessageScreen.tsx';
import FileTransferScreen from './screens/FileTransferScreen.tsx';
import { SocketProvider } from './providers/SocketProvider.tsx';
import ConnectionRequestScreen from './screens/ConnectionRequestScreen.tsx';

export type RootStackParamList = {
  Main: undefined;
  Message: { deviceIP: string, myIP: string | null };
  FileTransfer: { deviceIP: string };
  ConnectionRequest: { deviceIP: string, deviceName: string, myIP: string | null };
};

const Stack = createStackNavigator<RootStackParamList>();


function App(): React.JSX.Element {
  return (
    <SocketProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Main">
          <Stack.Screen name="Main" component={MainScreen} options={{ title: 'Device List' }} />
          <Stack.Screen name="Message" component={MessageScreen} options={{ title: 'Send Message' }} />
          <Stack.Screen name="FileTransfer" component={FileTransferScreen} options={{ title: 'Send File' }} />
          <Stack.Screen name="ConnectionRequest" component={ConnectionRequestScreen} options={{ title: 'Connection Request' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SocketProvider>
  );
}

export default App;
