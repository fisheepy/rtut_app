import { StyleSheet } from 'react-native';

const bannerHeight = 100;
const baseColor = '#d8dee6';
const menuColor = '#145369';
const bannerColor = '#6e909c';

export default StyleSheet.create({
    app: {
        container: {
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: baseColor,
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
            width: '75%',
            height: '100%',
            backgroundColor: menuColor,
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
            backgroundColor: bannerColor, // Change this to any color you prefer for the banner background
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
    },
    messageView: {
        container: {
            height: 50,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '100%',
            wordWrap: 'break-word',
            marginLeft: 18,
            borderWidth: 1,
            borderColor: 'black',
            marginBottom: 5,
        },
        readContainer: {
            backgroundColor: 'lightgray', // Style for read notifications
        },
        unreadContainer: {
            backgroundColor: 'white', // Style for unread notifications
        },
        subject: {
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 5,
            textAlign: 'center',
        },
        readSubject: {
            color: 'gray', // Style for read notification subjects
        },
        unreadSubject: {
            color: 'black', // Style for unread notification subjects
        },
        infoContainer: {
            fontSize: 14,
            color: 'gray',
            flexDirection: 'row',
        },
        sender: {
            marginLeft: '10px',
        },
        time: {
            marginLeft: 'auto',
            marginRight: '10px',
        },
    },
    messageDetail: {
        container: {
            flex: 1, 
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: baseColor,
        },
        content: {
            paddingBottom: 30, 
            minHeight: '30vw',
        },
        subject: {
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 5,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
        },
        info: {
            fontSize: 16,
            color: 'gray',
            textAlign: 'left',
            paddingHorizontal: 32,
        },
        body: {
            marginTop: 15,
            marginBottom: 15,
            fontSize: 16,
            color: 'black',
            textAlign: 'justify',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 16,
        },
        buttonContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            backgroundColor: baseColor,
          },
        buttonText: {
            fontWeight: 'bold',
            letterSpacing: 0.25,
            color: 'white',
        },
        infoContainer: {
            fontSize: 14,
            color: 'gray',
            flexDirection: 'row',
        },
        sender: {
            marginLeft: '15px',
        },
        time: {
            marginLeft: 'auto',
            marginRight: '15px',
        },
    },
    login: {
        container: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'transparent',
          },
          form: {
            minHeight: '100vw',
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
          },
          tabButton: {
            alignItems: 'center',
            justifyContent: 'center',
            height: 40,
            backgroundColor: '#839c83'
          },
          tabButtonText: {
          },
          backgroundImage: {
            flex: 1,
            width: '100%',
            height: '100%',
          },
    },
});