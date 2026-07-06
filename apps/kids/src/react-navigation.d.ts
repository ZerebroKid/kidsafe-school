/**
 * Patches TS2786 for @react-navigation components.
 * Same root cause: class component type mismatch with @types/react >=18.2.
 */

declare module '@react-navigation/native' {
  import type {FC, ReactNode} from 'react';

  interface Theme {
    dark: boolean;
    colors: {
      primary: string;
      background: string;
      card: string;
      text: string;
      border: string;
      notification: string;
    };
  }

  interface NavigationContainerProps {
    theme?: Theme;
    children?: ReactNode;
    [key: string]: any;
  }

  const NavigationContainer: FC<NavigationContainerProps>;
  const DefaultTheme: Theme;
  const DarkTheme: Theme;

  function useNavigation<T = any>(): T;
  function useRoute<T = any>(): T;

  export {NavigationContainer, DefaultTheme, DarkTheme, useNavigation, useRoute};
  export type {Theme, NavigationContainerProps};
}

declare module '@react-navigation/native-stack' {
  import type {FC, ReactNode} from 'react';

  interface ScreenOptions {
    headerShown?: boolean;
    title?: string;
    headerTitle?: string;
    headerStyle?: any;
    headerTintColor?: string;
    contentStyle?: any;
    animation?: string;
    [key: string]: any;
  }

  interface NavigatorProps {
    initialRouteName?: string;
    screenOptions?: ScreenOptions | ((props: any) => ScreenOptions);
    children?: ReactNode;
    [key: string]: any;
  }

  interface ScreenProps {
    name: string;
    component: FC<any> | React.ComponentType<any>;
    options?: ScreenOptions | ((props: any) => ScreenOptions);
    [key: string]: any;
  }

  interface NativeStackNavigationProp<ParamList = any, RouteName extends string = string> {
    navigate: (screen: any, params?: any) => void;
    goBack: () => void;
    reset: (state: any) => void;
    setParams: (params: any) => void;
    [key: string]: any;
  }

  interface NativeStackScreenProps<ParamList = any, RouteName extends string = string> {
    navigation: NativeStackNavigationProp<ParamList, RouteName>;
    route: {
      key: string;
      name: RouteName;
      params: any;
    };
  }

  function createNativeStackNavigator<ParamList = any>(): {
    Navigator: FC<NavigatorProps>;
    Screen: FC<ScreenProps>;
    Group: FC<{children?: ReactNode; screenOptions?: ScreenOptions}>;
  };

  export {createNativeStackNavigator};
  export type {NativeStackScreenProps, NativeStackNavigationProp, ScreenOptions};
}

declare module '@react-navigation/bottom-tabs' {
  import type {FC, ReactNode} from 'react';

  interface TabBarIconProps {
    focused: boolean;
    color: string;
    size: number;
  }

  interface BottomTabScreenOptions {
    headerShown?: boolean;
    title?: string;
    tabBarLabel?: string;
    tabBarIcon?: (props: TabBarIconProps) => ReactNode;
    tabBarStyle?: any;
    tabBarActiveTintColor?: string;
    tabBarInactiveTintColor?: string;
    [key: string]: any;
  }

  interface BottomTabNavigatorProps {
    initialRouteName?: string;
    screenOptions?: BottomTabScreenOptions | ((props: any) => BottomTabScreenOptions);
    children?: ReactNode;
    [key: string]: any;
  }

  interface TabScreenProps {
    name: string;
    component: FC<any> | React.ComponentType<any>;
    options?: BottomTabScreenOptions | ((props: any) => BottomTabScreenOptions);
    [key: string]: any;
  }

  interface BottomTabNavigationProp<ParamList = any, RouteName extends string = string> {
    navigate: (screen: any, params?: any) => void;
    goBack: () => void;
    jumpTo: (screen: any, params?: any) => void;
    setParams: (params: any) => void;
    [key: string]: any;
  }

  interface BottomTabScreenProps<ParamList = any, RouteName extends string = string> {
    navigation: BottomTabNavigationProp<ParamList, RouteName>;
    route: {
      key: string;
      name: RouteName;
      params: any;
    };
  }

  function createBottomTabNavigator<ParamList = any>(): {
    Navigator: FC<BottomTabNavigatorProps>;
    Screen: FC<TabScreenProps>;
  };

  export {createBottomTabNavigator};
  export type {
    BottomTabScreenOptions,
    TabBarIconProps,
    BottomTabScreenProps,
    BottomTabNavigationProp,
  };
}
