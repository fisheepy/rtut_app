import { StyleSheet } from 'react-native';
import 'typeface-open-sans';

const bannerHeight = 100;
const baseColor = '#f9f1db';
const menuColor = '#2e59a7';
const bannerColor = '#314a43';
const toggleColor = '#f3f3e7';
const settingColor = '#eeebda';
const bannerTextColor = '#f9f1db';
const tabColor = '#314a43';
const activeColor = '#041014';

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
            fontSize: 32,
            alignSelf: 'center', // Center the back icon
            marginTop: 50,
            marginBottom: 20, // Space below the back icon
            padding: 20,
            color: toggleColor, 
        },
        settingIcon: {
            fontSize: 32, 
            color: settingColor, 
        },
        content: {
            flex: 1,
            paddingTop: bannerHeight,
        },
        banner: {
            backgroundColor: bannerColor, // Change this to any color you prefer for the banner background
            width: '100%', // Match the width of the screen
            height: bannerHeight, // Fixed height for the banner section
            justifyContent: 'flex-end', // Center content vertically within the banner
            alignItems: 'center', // Center content horizontally within the banner
            position: 'absolute', // Position absolute to ensure it does not affect layout flow
            top: 0, // Align to the top of the screen
            zIndex: 0, // Ensure it's behind the menu and other content
        },
        bannerText: {
            marginBottom: 15,
            color: bannerTextColor, // Text color for the banner
            fontSize: 20, // Adjust the font size as needed
            fontWeight: 'Bold',
            fontFamily: 'Open Sans',
        },
    },
    messageView: {
        container: {
            height: 80,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '100%',
            wordWrap: 'break-word',
            marginLeft: 0,
        },
        headLine: {
            height: 20,
            flexDirection: 'row',
        },
        subjectLine: {
            height: 20,
            alignItems: 'flex-start',
            marginLeft: 25,
        },
        subject: {
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center',
            fontFamily: 'Open Sans',
        },
        sender: {
            fontSize: 12,
            marginLeft: '10px',
            fontFamily: 'Open Sans',
        },
        time: {
            fontSize: 12,
            marginLeft: 'auto',
            marginRight: '0px',
            fontFamily: 'Open Sans',
        },
        indicator: {
            height: 10,
            width: 10,
            borderRadius: 5,
            marginRight: 5,
            alignSelf: 'center',
        },
        readIndicator: {
        },
        unreadIndicator: {
            backgroundColor: 'green', // Color for unread messages
        },
    },
    messageDetail: {
        container: {
            flex: 1, 
            flexGrow: 1,
            justifyContent: 'space-between',
            alignItems: 'stretch',
            backgroundColor: baseColor,
        },
        content: {
            minHeight: '30vw',
        },
        subject: {
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 5,
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            fontFamily: 'Open Sans',
        },
        info: {
            fontSize: 16,
            color: 'gray',
            textAlign: 'left',
            paddingHorizontal: 32,
            fontFamily: 'Open Sans',
        },
        contentContainer: {
            flexGrow: 1, // Important for making sure the container can grow
            justifyContent: 'flex-start', // Centers content when less than screen height
            backgroundColor: baseColor,
        },
        body: {
            fontSize: 16,
            color: 'black',
            textAlign: 'justify',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
            fontFamily: 'Open Sans',
            backgroundColor: baseColor,
            paddingBottom: 30, 
        },
        buttonContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            backgroundColor: baseColor,
            paddingBottom: 30, 
          },
        buttonText: {
            fontWeight: 'bold',
            letterSpacing: 0.25,
            color: 'white',
            fontFamily: 'Open Sans',
        },
        infoContainer: {
            paddingHorizontal: 32,
            fontSize: 14,
            color: 'gray',
            flexDirection: 'row',
            paddingBottom: 15,
        },
        sender: {
            fontSize: 14,
            marginLeft: '15px',
            fontFamily: 'Open Sans',
        },
        time: {
            fontSize: 14,
            marginLeft: 'auto',
            marginRight: '15px',
            fontFamily: 'Open Sans',
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
    useSetting: {
        container: {
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 50,
        },
        iconLink: {
            flexDirection: 'column',
            alignItems: 'center',
            marginVertical: 10,
        },
        toggleText: {
            fontSize: 16,
            fontWeight: 'bold',
            color: toggleColor,
            fontFamily: 'Open Sans',
        },
        feedbackButton: {
            fontSize: 36,
            marginTop: 20,
            padding: 10,
            borderRadius: 5,
            alignItems: 'center',
            fontFamily: 'Open Sans',
        },
        feedbackButtonText: {
            fontSize: 16,
            color: '#ffffff',
            fontFamily: 'Open Sans',
        },
        centeredView: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.4)', // Semi-transparent background
        },
        modalView: {
            margin: 20,
            backgroundColor: '#6e909c',
            borderRadius: 20,
            padding: 35,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
            width: '80%', // Fixed width for the modal
            maxHeight: '80%', // Maximum height to avoid covering the entire screen
        },
        feedbackInput: {
            backgroundColor: 'lightgray',
            width: '100%', // Take up all available width within the modal
            minHeight: 250, // Minimum height for the text input
            marginBottom: 20, // Margin bottom for spacing
            borderColor: '#ccc', // Border color for the text input
            borderWidth: 1, // Border width
            padding: 10, // Padding inside the text input
        },
        nameInput: {
            backgroundColor: 'lightgray',
            width: '60%', // Take up all available width within the modal
            minHeight: 25, // Minimum height for the text input
            marginBottom: 20, // Margin bottom for spacing
            borderColor: '#ccc', // Border color for the text input
            borderWidth: 1, // Border width
            padding: 10, // Padding inside the text input
        },
        buttonGroup: {
            flexDirection: 'row',
            justifyContent: 'center',
            marginBottom: 20,
        },
        buttonClose: {
            marginTop: 15,
        },
        textStyle: {
            color: "white",
            fontWeight: "bold",
            textAlign: "center"
        },
        linkText: {
            fontSize: 12,
            color: toggleColor,
            textAlign: 'justify',
            fontFamily: 'Open Sans',
        },
    },
    notificationModal: {
        container: {
            flex: 1,
            padding: 10,
            backgroundColor: baseColor,
            position: 'static',
            alignItems: 'center',
            justifyContent: 'center',
        },
        tabButtonContainer: {
            flexDirection: 'row',
            alignItems: 'end',
            justifyContent: 'center',
            width: '100vw',
            backgroundColor: tabColor,
        },
        tabButton: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            fontWeight: 'bold',
            marginBottom: 15,
        },
        activeTab: {
            color: activeColor,
        },
        inactiveTab: {
            color:baseColor,
        },
        messagesContainer: {
            marginTop: 10,
            width: '90vw',
        },
        notificationContainer: {
            width: '90vw',
        },
        tabButtonText: {
            fontSize: 16,
            fontWeight: 'bold',
        },
        refreshButtonContainer: {
            marginTop: 20,
            alignItems: 'center',
        },
        refreshButton: {
            backgroundColor: '#007bff',
            padding: 10,
            borderRadius: 5,
        },
        completedSurvey: {
            opacity: 0.5,
        },
    },
    SurveyRenderer: {
        container: {
            width: '100vw',
            backgroundColor: baseColor,
          },
          questionContainer: {
            marginBottom: 20,
            paddingHorizontal: 30,
            width: '90vw',
          },
          text:
          {
            textAlign: 'justify',
            fontFamily: 'Open Sans',
            fontSize: 12,
          },
          title: {
            textAlign: 'center',
            marginBottom: 10,
            fontFamily: 'Open Sans',
            fontWeight: 'bold',
            fontSize: 12,
          },
          choiceContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 10,
            width: '90vw',
          },
          radioCircle: {
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#000',
            marginHorizontal: 10,
            justifyContent: 'center',
            alignItems: 'center',
          },
          selectedRadio: {
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: '#000',
          },
          input: {
            borderWidth: 1,
            borderColor: '#ccc',
            padding: 10,
            borderRadius: 5,
            fontFamily: 'Open Sans',
            fontSize: 12,
          },
          checkbox: {
            width: 20,
            height: 20,
            borderWidth: 1,
            borderColor: '#000',
            marginHorizontal: 10,
            justifyContent: 'center',
            alignItems: 'center',
          },
          checkedBox: {
            width: 12,
            height: 12,
            backgroundColor: '#000',
            fontFamily: 'Open Sans',
          },
          sliderContainer: {
            width: '90vw',
          },
          buttonContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            width: '100vw',
            marginBottom: 20,
          },
    },
});