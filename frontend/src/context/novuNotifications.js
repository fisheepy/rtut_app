import React, { useContext, createContext, useEffect, useState, useRef, useCallback } from "react";
import { HeadlessService } from '@novu/headless';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NotificationContext = createContext();

const NotificationProvider = ({ children, applicationIdentifier, subscriberId }) => {

    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const pageNumRef = useRef(0);
    const headlessServiceRef = useRef(null);
    const [pageNum, setPageNum] = useState(0);
    const [allFetchedNotifications, setAllFetchedNotifications] = useState([]);
    const [isInitialized, setIsInitialized] = useState(false);

    const fetchPageNotifications = useCallback((page) => {
        return new Promise((resolve, reject) => {
            const headlessService = headlessServiceRef.current;
            console.log('fetch page'+page);
            if (headlessService) {
                headlessService.fetchNotifications({
                    listener: ({ data, error, isError, isFetching, isLoading, status }) => {
                        // Handle the state of the fetching process and errors here
                    },
                    onSuccess: (response) => {
                        const fetchedNotifications = response.data || [];
                        // Instead of setting state here, we accumulate in a temporary array
                        setAllFetchedNotifications(prev => [...prev, ...fetchedNotifications]);
                        // Determine if we should continue fetching
                        if (fetchedNotifications.length < 10) {
                            resolve('end');
                        } else {
                            pageNumRef.current += 1;
                            resolve(pageNumRef.current);
                        }
                    },
                    onError: (error) => {
                        console.error('Error fetching notifications:', error);
                        reject(error); // Reject the promise on error
                    },
                    page: page,
                });
            } else {
                reject('Headless service not initialized');
            }
        });
    }, []);

    const fetchAllNotifications = useCallback(async () => {
        const userId = await AsyncStorage.getItem('userId'); 
        if (headlessServiceRef){
            setIsLoading(true);
            pageNumRef.current = 0; // Start from the first page
            setNotifications([]); // Optionally reset notifications before fetching
    
            try {
                let nextPageToFetch = pageNumRef.current;
                let fetchMore = true;
    
                while (fetchMore) {
                    const result = await fetchPageNotifications(nextPageToFetch);
    
                    if (result === 'end') {
                        fetchMore = false;
                    } else {
                        nextPageToFetch = result;
                    }
                }
                // Once all pages have been fetched, deduplicate notifications
                const uniqueNotifications = Array.from(new Map(allFetchedNotifications.map(notif => [notif.id, notif])).values());
                const sortedNotifications = uniqueNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
                setNotifications(sortedNotifications);
                console.log('fetchAllNotifications successful!');
                await AsyncStorage.setItem(`notifications_${userId}`, JSON.stringify(sortedNotifications));
            } catch (error) {
                console.error('An error occurred during fetching notifications:', error);
            } finally {
                setIsLoading(false);
            }
        }
    }, [fetchPageNotifications, allFetchedNotifications]);

    useEffect(() => {
        if (subscriberId) {
            const headlessService = new HeadlessService({
                applicationIdentifier: applicationIdentifier,
                subscriberId: subscriberId,
            });

            headlessService.initializeSession({
                listener: (res) => {
                },
                onSuccess: (session) => {
                    headlessServiceRef.current = headlessService;
                    console.log(headlessServiceRef, ' initialization success.');
                    setIsInitialized(true);
                    fetchAllNotifications();
                },
                onError: (error) => {
                    console.log("headlessSice error:", error);
                },
            })
        }
    }, [applicationIdentifier, subscriberId])

    // Function to mark notifications as read
    const markNotificationsAsRead = (messageIds) => {
        if (!Array.isArray(messageIds)) {
            messageIds = [messageIds];
        }

        const headlessService = headlessServiceRef.current;

        if (headlessService) {
            headlessService.markNotificationsAsRead({
                messageId: messageIds,
                listener: (result) => {
                },
                onError: (error) => {
                    console.error('Error marking notifications as read:', error);
                },
            });
        }
    };

    const deleteNotification = (messageId) => {
        const headlessService = headlessServiceRef.current;
        if (headlessService) {
            headlessService.removeNotification({
                messageId: messageId,
                listener: function (result) {
                },
                onSuccess: function (message) {
                },
                onError: function (error) {
                    console.error(error);
                },
                messageIds: 'messageOne',
            });

        }
    }

    const markAllMessagesAsRead = (feedId) => {
        const headlessService = headlessServiceRef.current;

        headlessService.markAllMessagesAsRead({
            listener: (result) => {
                console.log(result);
                // Handle the result of marking all messages as read
                // You can update the state or perform other actions here
            },
            onError: (error) => {
                console.error('Error marking all messages as read:', error);
                // Implement error handling if needed
            },
            feedId: feedId, // Pass the feed ID here, it can be an array or a single ID
        });
    };

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                markNotificationsAsRead,
                markAllMessagesAsRead,
                deleteNotification,
                pageNum,
                setPageNum,
                fetchPageNotifications,
                fetchAllNotifications,
                isInitialized,
            }}>
            {children}
        </NotificationContext.Provider>
    )
}

const useNotification = () => useContext(NotificationContext);

export { useNotification, NotificationProvider };
