import React, { useEffect, useState, useCallback } from 'react';
import { useNotification } from './context/novuNotifications';
import { View, Pressable, Text, StyleSheet, ScrollView } from 'react-native';
import MessageViewComponent from './messageViewComponent';
import MessageDetailComponent from './messageDetailComponent'
import SurveyRenderer from './surveyRenderer';
import { CiSquareQuestion, CiCirclePlus } from "react-icons/ci";
import { TfiAnnouncement } from "react-icons/tfi";
import AsyncStorage from '@react-native-async-storage/async-storage';

const getStorageKey = (userId) => `notifications_${userId}`;

const NotificationModal = ({ windowDimensions, isPulledDown }) => {
    const styles = StyleSheet.create({
        container: {
            flex: 1,
            padding: 10,
            width: windowDimensions.width * 1,
            backgroundColor: '#d8dee6',
            position: 'static',
            alignItems: 'center',
            justifyContent: 'center',
        },
        tabButtonContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 15,
            width: '90vw',
            height: 80,
        },
        tabButton: {
            flex: 1,
            alignItems: 'center',
            height: 60,
        },
        activeTab: {
            color: 'green',
        },
        messagesContainer: {
            width: '90vw',
            height: windowDimensions.height - 234,
        },
        notificationContainer: {
            width: '90vw',
        },
        tabButtonText: {
            fontSize: 16,
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
    });

    const { notifications, markNotificationsAsRead, markAllMessagesAsRead, deleteNotification, fetchAllNotifications } = useNotification();
    const [qualifiedNotifications, setQualifiedNotifications] = useState([]);
    const [detailViewMode, setDetailViewMode] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [currentTab, setCurrentTab] = useState('notifications'); // Default tab is notifications
    const [fetchNeeded, setFetchNeeded] = useState(true);
    const [filteredNotifications, setFilteredNotifications] = useState([]);
    const [lastFetchTime, setLastFetchTime] = useState(() => {
        // Retrieve the last fetch time from localStorage or set to 0
        return parseInt(localStorage.getItem('lastFetchTime'), 10) || 0;
    });
    const completedSurveys = JSON.parse(localStorage.getItem('completedSurveys') || '[]');

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                const elapsedTime = now - lastFetchTime;

                if (elapsedTime > FETCH_INTERVAL) {
                    setFetchNeeded(true);
                }
            }
        };
        const checkAndFetchNotifications = () => {
            const now = Date.now();
            const elapsedTime = now - lastFetchTime;

            if (elapsedTime > FETCH_INTERVAL) {
                console.log('Fetching notifications due to time interval...');
                setFetchNeeded(true);
            }
        };
        const FETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

        document.addEventListener('visibilitychange', handleVisibilityChange);
        const intervalId = setInterval(checkAndFetchNotifications, FETCH_INTERVAL); // Check every 5 minutes
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(intervalId); // Clean up the interval when the component unmounts or dependencies change
        };
    }, [lastFetchTime, fetchAllNotifications]);

    useEffect(() => {
        const loadCachedNotifications = async () => {
            try {
                const userId = await AsyncStorage.getItem('userId');
                const cachedNotifications = await AsyncStorage.getItem(getStorageKey(userId));
                if (cachedNotifications) {
                    setQualifiedNotifications(JSON.parse(cachedNotifications));
                    setFetchNeeded(false);
                } else {
                    setFetchNeeded(true);
                }
            } catch (error) {
                setQualifiedNotifications([]);
                setFetchNeeded(true);
            }
        };

        loadCachedNotifications();
    }, []);

    useEffect(() => {
        if (fetchNeeded) {
            console.log('Fetch all!');
            fetchAllNotifications().then(() => {
                console.log('Notifications fetched successfully.');
                // Assuming fetchAllNotifications updates the notifications context,
                // the useEffect hook below will trigger and updateQualifiedNotifications.
            }).catch(error => console.error('Failed to fetch notifications:', error));
            setFetchNeeded(false);
            const now = Date.now();
            setLastFetchTime(now);
            localStorage.setItem('lastFetchTime', now.toString());
        }
    }, [fetchNeeded, fetchAllNotifications]);

    // Respond to Changes in Notifications State
    useEffect(() => {
        // This will run after notifications state is updated in the context
        const updateQualifiedNotifications = async () => {
            await AsyncStorage.setItem('qualifiedNotifications', JSON.stringify(notifications));
            setQualifiedNotifications(notifications); // Now this uses the updated notifications
            console.log('updateQualifiedNotifications!'); // This should now log the updated state
        };

        if (notifications.length > 0) {
            updateQualifiedNotifications();
        }
    }, [notifications]);

    useEffect(() => {
        if (isPulledDown) {
            // Call your custom function here
            console.log('Refetch due to pull down');
            setFetchNeeded(true);
        }
    }, [isPulledDown]);

    useEffect(() => {
        // Update filteredNotifications when qualifiedNotifications or currentTab changes
        console.log('Update filtered notifications!');
        const newFilteredNotifications = qualifiedNotifications.filter(notification => {
            if (currentTab === 'notifications') {
                return notification.payload.messageType === 'NOTIFICATION';
            } else if (currentTab === 'surveys') {
                return notification.payload.messageType === 'SURVEY';
            } else {
                return !['NOTIFICATION', 'SURVEY'].includes(notification.payload.messageType);
            }
        });
        setFilteredNotifications(newFilteredNotifications);
    }, [qualifiedNotifications, currentTab]);

    useEffect(() => {
        // Logic that needs to run when detailViewMode changes
        if (detailViewMode) {
          // If detailViewMode is true, perform actions for detail view being active
        } else {
          // If detailViewMode is false, perform actions for returning to the list view
          // For example, refreshing the list view to reflect any changes
          setFetchNeeded(true);
        }
      }, [detailViewMode]); 

    const handleNotificationPress = useCallback((notification) => {
        markNotificationsAsRead(notification.id);
        setSelectedNotification(notification);
        console.log(notification);
        console.log(selectedNotification);
        setDetailViewMode(true);
    }, [markNotificationsAsRead]);

    const handleReadNotification = () => {
        setDetailViewMode(false);
    };

    const handleSurveyComplete = async (answers) => {
        try {
            const timestamp = Date.now();
            const surveyId = selectedNotification.payload.uniqueId;
            // Send the survey result to the server
            const response = await fetch('https://rtut-app-admin-server-c2d4ae9d37ae.herokuapp.com/submit-survey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ surveyId, answers, timestamp }),
            });

            if (!response.ok) {
                throw new Error('Failed to submit survey: ' + response.statusText);
            }

            // Handle the server response if needed
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const responseData = await response.json();
                console.log('Survey submitted successfully:', responseData);
            }
            else {
                // Handle non-JSON responses
                console.log('Survey submitted successfully:', response.statusText);
            }
        } catch (error) {
            console.error('Error submitting survey:', error.message);
        }
        setDetailViewMode(false);
    };

    const handleTabChange = useCallback((tab) => {
        setCurrentTab(tab);
    }, []);

    return (
        <View style={styles.container}>
            {detailViewMode ? (
                currentTab === 'surveys' ? (
                    <SurveyRenderer
                        surveyJson={JSON.parse(selectedNotification.payload.messageContent)}
                        onCancel={() => setDetailViewMode(false)}
                        onSurveyComplete={handleSurveyComplete}
                        windowDimensions={windowDimensions}
                    />
                ) : (
                    <MessageDetailComponent
                        notification={selectedNotification}
                        onBack={handleReadNotification}
                        windowDimensions={windowDimensions}
                    />
                )
            ) : (
                <ScrollView
                    style={styles.messagesContainer}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                >
                    {filteredNotifications.map(notification => (
                        <View
                            key={notification.id}
                            style={[
                                styles.notificationContainer,
                                completedSurveys.includes(notification.id) && styles.completedSurvey,
                            ]}
                        >
                            <MessageViewComponent
                                notification={notification}
                                onPress={() => {
                                    if (currentTab!=='surveys' || !completedSurveys.includes(notification.id)) {
                                        console.log(notification);
                                        handleNotificationPress(notification);
                                    }
                                }}
                                windowDimensions={windowDimensions}
                            />
                        </View>
                    ))}
                </ScrollView>
            )}
            {!detailViewMode && (
                <View style={styles.tabButtonContainer}>
                    <Pressable
                        style={[styles.tabButton, currentTab === 'notifications' && styles.activeTab]}
                        onPress={() => handleTabChange('notifications')}
                    >
                        <TfiAnnouncement style={{ fontSize: 36 }} />
                        <Text style={styles.tabButtonText}>Notification</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tabButton, currentTab === 'surveys' && styles.activeTab]}
                        onPress={() => handleTabChange('surveys')}
                    >
                        <CiSquareQuestion style={{ fontSize: 36 }} />
                        <Text style={styles.tabButtonText}>Survey</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tabButton, currentTab === 'others' && styles.activeTab]}
                        onPress={() => handleTabChange('others')}
                    >
                        <CiCirclePlus style={{ fontSize: 36 }} />
                        <Text style={styles.tabButtonText}>Other</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
}

export default NotificationModal;