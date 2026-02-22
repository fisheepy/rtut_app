import React, { useMemo, useState, useEffect } from 'react';
import axios from "axios";

function LoginComponent({ onLoginStatusChange, onLoginSuccess }) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [enteredCode, setEnteredCode] = useState('');
    const [userMessage, setUserMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [isRequestingCode, setIsRequestingCode] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [codeCooldown, setCodeCooldown] = useState(0);

    useEffect(() => {
        if (codeCooldown <= 0) {
            return;
        }

        const timer = setInterval(() => {
            setCodeCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [codeCooldown]);

    const canRequestCode = useMemo(() => {
        return firstName.trim() && lastName.trim() && !isRequestingCode && codeCooldown === 0;
    }, [firstName, lastName, isRequestingCode, codeCooldown]);

    const canLogin = useMemo(() => {
        return firstName.trim() && lastName.trim() && enteredCode.trim() && !isLoggingIn;
    }, [firstName, lastName, enteredCode, isLoggingIn]);

    const handleLogin = async (e) => {
        e?.preventDefault();

        if (!canLogin) {
            setUserMessage('Please enter first name, last name, and one-time code.');
            setMessageType('error');
            return;
        }

        setIsLoggingIn(true);
        setUserMessage('Validating code...');
        setMessageType('info');

        try {
            const response = await fetch('/call-function-validate-log-in', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), enteredCode: enteredCode.trim() })
            });

            if (response.ok) {
                setUserMessage('Login successful. Redirecting...');
                setMessageType('success');
                onLoginStatusChange(true);
                onLoginSuccess({ firstName: firstName.trim(), lastName: lastName.trim() });
                localStorage.setItem('loginName', JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }));
            } else {
                const errorMsg = await response.text();
                setUserMessage(errorMsg || 'Invalid login attempt.');
                setMessageType('error');
                onLoginStatusChange(false);
            }
        } catch (error) {
            setUserMessage('Unable to log in right now. Please try again.');
            setMessageType('error');
            onLoginStatusChange(false);
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleRequestCode = async (e) => {
        e?.preventDefault();

        if (!firstName.trim() || !lastName.trim()) {
            setUserMessage('Please enter both first and last name before requesting a code.');
            setMessageType('error');
            return;
        }

        if (codeCooldown > 0) {
            setUserMessage(`Please wait ${codeCooldown}s before requesting another code.`);
            setMessageType('info');
            return;
        }

        setIsRequestingCode(true);
        setUserMessage('Requesting one-time code...');
        setMessageType('info');

        try {
            await axios.post('/call-function-send-one-time-code', {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
            });
            setCodeCooldown(60);
            setUserMessage('A one-time code has been sent. It expires quickly for security.');
            setMessageType('success');
        } catch (error) {
            if (error.response?.status === 403) {
                setUserMessage('You are not authorized to request a one-time code.');
            } else {
                setUserMessage('Unable to send code. Please verify your name and try again.');
            }
            setMessageType('error');
        } finally {
            setIsRequestingCode(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className='login-header'>
                    <h1>RTUT Admin Login</h1>
                    <p>Use your admin name and one-time code to continue.</p>
                </div>

                <form className="login-section" onSubmit={handleRequestCode}>
                    <h2>Step 1: Verify your name</h2>
                    <div className="login-input-row">
                        <input
                            type="text"
                            placeholder="First Name"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Last Name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                        />
                    </div>
                    <button type="submit" disabled={!canRequestCode}>
                        {isRequestingCode ? 'Requesting...' : codeCooldown > 0 ? `Resend in ${codeCooldown}s` : 'Request One-Time Code'}
                    </button>
                </form>

                <form className="login-section" onSubmit={handleLogin}>
                    <h2>Step 2: Enter code</h2>
                    <div className="login-input-row single">
                        <input
                            type="text"
                            placeholder="Enter One-Time Code"
                            value={enteredCode}
                            onChange={(e) => setEnteredCode(e.target.value)}
                        />
                    </div>
                    <button type="submit" disabled={!canLogin}>
                        {isLoggingIn ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                {userMessage && (
                    <p className={`user-message ${messageType}`}>{userMessage}</p>
                )}
            </div>
        </div>
    )
}

export default LoginComponent;
