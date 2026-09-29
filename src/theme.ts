import { createContext, useContext } from 'react';

export const lightTheme = {
  background: '#F5F7F1', surface: '#FFFFFF', text: '#173B2B', muted: '#586C60',
  primary: '#176B48', tint: '#DDEFE3', line: '#DDE5DC', expense: '#B42332', income: '#176B48',
};
export const darkTheme: typeof lightTheme = {
  background: '#101B17', surface: '#1C2B24', text: '#ECF5EE', muted: '#A9BBAE',
  primary: '#91DCB8', tint: '#264B39', line: '#35483E', expense: '#FF929B', income: '#91DCB8',
};
export const ThemeContext = createContext(lightTheme);
export const useTheme = () => useContext(ThemeContext);
