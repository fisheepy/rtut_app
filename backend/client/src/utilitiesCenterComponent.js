import React, { useContext, useEffect, useMemo, useState } from 'react';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import axios from 'axios';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItem,
    ListItemText,
    TextField,
    Typography,
} from '@mui/material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { cleanFilterLabel, normalizeFilterValue } from './employeeFilterUtils';
import './App.css';

const emptyEmployee = () => ({
    firstName: '', lastName: '', email: '', phone: '',
    hireDate: new Date().toISOString().split('T')[0],
    homeDepartment: '', jobTitle: '', location: '', supervisorFirstName: '', supervisorLastName: '',
    eeoc: '', workCategory: '', payCategory: '',
});

const referenceFields = [
    { form: 'homeDepartment', database: 'Home Department', label: 'Home Department' },
    { form: 'jobTitle', database: 'Job Title', label: 'Job Title' },
    { form: 'location', database: 'Location', label: 'Location' },
    { form: 'eeoc', database: 'EEOC Establishment', label: 'EEOC' },
    { form: 'workCategory', database: 'Worker Category', label: 'Employment Category' },
    { form: 'payCategory', database: 'Pay Category', label: 'Pay Category' },
];

const requiredFields = [
    ['firstName', 'First Name'], ['lastName', 'Last Name'], ['email', 'Email'], ['phone', 'Phone'],
    ['hireDate', 'Hire Date'], ['homeDepartment', 'Home Department'], ['jobTitle', 'Job Title'],
    ['location', 'Location'], ['supervisorFirstName', 'Supervisor First Name'],
    ['supervisorLastName', 'Supervisor Last Name'], ['eeoc', 'EEOC'],
    ['workCategory', 'Employment Category'], ['payCategory', 'Pay Category'],
];

const canonicalMap = (values) => {
    const result = new Map();
    values.map(cleanFilterLabel).filter(Boolean).forEach(value => {
        const key = normalizeFilterValue(value);
        const current = result.get(key);
        if (!current || (current === current.toUpperCase() && value !== value.toUpperCase())) result.set(key, value);
    });
    return result;
};

const UtilitiesCenterComponent = () => {
    useContext(SelectedEmployeesContext);
    const [executionStatus, setExecutionStatus] = useState('Status:');
    const [openAddModal, setOpenAddModal] = useState(false);
    const [openDeleteModal, setOpenDeleteModal] = useState(false);
    const [openNewValueConfirmation, setOpenNewValueConfirmation] = useState(false);
    const [deleteEmployee, setDeleteEmployee] = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [newEmployee, setNewEmployee] = useState(emptyEmployee);
    const [referenceEmployees, setReferenceEmployees] = useState([]);
    const [referenceError, setReferenceError] = useState('');
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!openAddModal) return;
        let active = true;
        axios.get('/employees').then(response => {
            if (active) setReferenceEmployees(response.data || []);
        }).catch(() => {
            if (active) setReferenceError('Existing employee values could not be loaded. Please close and try again.');
        });
        return () => { active = false; };
    }, [openAddModal]);

    const referenceMaps = useMemo(() => Object.fromEntries(referenceFields.map(field => [
        field.form,
        canonicalMap(referenceEmployees.map(employee => employee[field.database])),
    ])), [referenceEmployees]);

    const supervisorMap = useMemo(() => {
        const map = new Map();
        referenceEmployees.forEach(employee => {
            const pairs = [
                [employee['Supervisor First Name'], employee['Supervisor Last Name']],
                [employee['First Name'], employee['Last Name']],
            ];
            pairs.forEach(([first, last]) => {
                const cleanFirst = cleanFilterLabel(first);
                const cleanLast = cleanFilterLabel(last);
                if (cleanFirst && cleanLast) map.set(`${normalizeFilterValue(cleanFirst)}|${normalizeFilterValue(cleanLast)}`, [cleanFirst, cleanLast]);
            });
        });
        return map;
    }, [referenceEmployees]);

    const newReferenceValues = useMemo(() => {
        const entries = referenceFields.flatMap(field => {
            const value = cleanFilterLabel(newEmployee[field.form]);
            return value && !referenceMaps[field.form]?.has(normalizeFilterValue(value))
                ? [{ field: field.form, label: field.label, value }]
                : [];
        });
        const first = cleanFilterLabel(newEmployee.supervisorFirstName);
        const last = cleanFilterLabel(newEmployee.supervisorLastName);
        if (first && last && !supervisorMap.has(`${normalizeFilterValue(first)}|${normalizeFilterValue(last)}`)) {
            entries.push({ field: 'supervisor', label: 'Supervisor', value: `${first} ${last}` });
        }
        return entries;
    }, [newEmployee, referenceMaps, supervisorMap]);
    const missingFields = requiredFields.filter(([field]) => !cleanFilterLabel(newEmployee[field]));
    const newFieldNames = new Set(newReferenceValues.map(entry => entry.field));

    const handleAddEmployeeChange = (field, value) => {
        const nextValue = field === 'hireDate' && value ? value.toISOString().split('T')[0] : value;
        setNewEmployee(previous => ({ ...previous, [field]: nextValue }));
    };

    const fieldProps = (field, label, type = 'text') => ({
        margin: 'dense', name: field, label, type, fullWidth: true, variant: 'outlined', required: true,
        value: newEmployee[field],
        error: (attemptedSubmit && !cleanFilterLabel(newEmployee[field])) || newFieldNames.has(field),
        helperText: newFieldNames.has(field)
            ? `New information: “${cleanFilterLabel(newEmployee[field])}” is not currently used in the database.`
            : attemptedSubmit && !cleanFilterLabel(newEmployee[field]) ? `${label} is required.` : '',
        FormHelperTextProps: newFieldNames.has(field) ? { sx: { color: '#d32f2f', fontWeight: 700 } } : undefined,
        onChange: event => handleAddEmployeeChange(field, event.target.value),
    });

    const canonicalEmployeePayload = () => {
        const payload = { ...newEmployee };
        referenceFields.forEach(field => {
            const value = cleanFilterLabel(payload[field.form]);
            payload[field.form] = referenceMaps[field.form]?.get(normalizeFilterValue(value)) || value;
        });
        const supervisor = supervisorMap.get(`${normalizeFilterValue(payload.supervisorFirstName)}|${normalizeFilterValue(payload.supervisorLastName)}`);
        if (supervisor) [payload.supervisorFirstName, payload.supervisorLastName] = supervisor;
        payload.firstName = cleanFilterLabel(payload.firstName);
        payload.lastName = cleanFilterLabel(payload.lastName);
        payload.email = cleanFilterLabel(payload.email);
        payload.phone = cleanFilterLabel(payload.phone);
        return payload;
    };

    const requestAddEmployee = () => {
        setAttemptedSubmit(true);
        if (missingFields.length || referenceError) return;
        if (newReferenceValues.length) setOpenNewValueConfirmation(true);
        else handleAddEmployeeSubmit(false);
    };

    const handleAddEmployeeSubmit = async (approveNewValues = false, approvedReactivation = false) => {
        setIsSaving(true);
        try {
            const payload = { ...canonicalEmployeePayload(), approvedNewValues: newReferenceValues.length > 0 && approveNewValues === true, approvedReactivation };
            await axios.post('/call-function-add-employee', payload);
            setExecutionStatus(`Employee ${payload.firstName} ${payload.lastName} added successfully.`);
            setOpenNewValueConfirmation(false);
            setOpenAddModal(false);
            setNewEmployee(emptyEmployee());
            setAttemptedSubmit(false);
        } catch (error) {
            const errorMessage = error.response?.data || 'An unexpected error occurred';
            if (String(errorMessage).startsWith('Possible former employee match:')) {
                const approved = window.confirm(`${errorMessage}\n\nSelect OK only if this is the same returning employee. The previous onboarding record will be archived and a new onboarding cycle will begin.`);
                if (approved) {
                    setIsSaving(false);
                    await handleAddEmployeeSubmit(approveNewValues, true);
                    return;
                }
            }
            setExecutionStatus(`Failed to add employee ${newEmployee.firstName} ${newEmployee.lastName}: ${errorMessage}`);
            setOpenNewValueConfirmation(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEmployeeChange = event => {
        const { name, value } = event.target;
        setDeleteEmployee(previous => ({ ...previous, [name]: value }));
    };

    const handleDeleteEmployeeSubmit = async () => {
        try {
            await axios.post('/call-function-delete-employee', deleteEmployee);
            setExecutionStatus(`Employee ${deleteEmployee.firstName} ${deleteEmployee.lastName} deleted successfully.`);
            setOpenDeleteModal(false);
        } catch (error) {
            setExecutionStatus(`Failed to delete employee ${deleteEmployee.firstName} ${deleteEmployee.lastName}: ${error.response?.data || 'An unexpected error occurred'}`);
        }
    };

    return (
        <div>
            <h3>Execution Status</h3>
            <p>{executionStatus}</p>
            <Button variant="outlined" onClick={() => { setReferenceError(''); setOpenAddModal(true); }}>Add New Employee</Button>
            <Button variant="outlined" color="secondary" onClick={() => setOpenDeleteModal(true)}>Delete Employee</Button>

            <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} fullWidth maxWidth="sm">
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 1 }}>All fields are required. Existing values are matched without regard to capitalization, extra spaces, or slash formatting.</Alert>
                    {referenceError ? <Alert severity="error" sx={{ mb: 1 }}>{referenceError}</Alert> : null}
                    <TextField autoFocus {...fieldProps('firstName', 'First Name')} />
                    <TextField {...fieldProps('lastName', 'Last Name')} />
                    <TextField {...fieldProps('email', 'Email', 'email')} />
                    <TextField {...fieldProps('phone', 'Phone', 'tel')} />
                    <Typography variant="subtitle1" sx={{ mt: 2 }}>Hire Date *</Typography>
                    <DatePicker selected={newEmployee.hireDate ? new Date(`${newEmployee.hireDate}T00:00:00`) : null} onChange={date => handleAddEmployeeChange('hireDate', date)} dateFormat="yyyy-MM-dd" wrapperClassName="datePicker" />
                    {attemptedSubmit && !newEmployee.hireDate ? <Typography color="error" variant="caption">Hire Date is required.</Typography> : null}
                    <TextField {...fieldProps('homeDepartment', 'Home Department')} />
                    <TextField {...fieldProps('jobTitle', 'Job Title')} />
                    <TextField {...fieldProps('location', 'Location')} />
                    <TextField {...fieldProps('supervisorFirstName', 'Supervisor First Name')} error={(attemptedSubmit && !newEmployee.supervisorFirstName) || newFieldNames.has('supervisor')} helperText={newFieldNames.has('supervisor') ? 'New information: this supervisor name is not currently used in the database.' : attemptedSubmit && !newEmployee.supervisorFirstName ? 'Supervisor First Name is required.' : ''} />
                    <TextField {...fieldProps('supervisorLastName', 'Supervisor Last Name')} error={(attemptedSubmit && !newEmployee.supervisorLastName) || newFieldNames.has('supervisor')} helperText={newFieldNames.has('supervisor') ? 'Confirm this new supervisor before submitting.' : attemptedSubmit && !newEmployee.supervisorLastName ? 'Supervisor Last Name is required.' : ''} />
                    <TextField {...fieldProps('eeoc', 'EEOC')} />
                    <TextField {...fieldProps('workCategory', 'Employment Category')} />
                    <TextField {...fieldProps('payCategory', 'Pay Category')} />
                    {newReferenceValues.length ? (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            <Typography fontWeight={700}>New database information detected:</Typography>
                            {newReferenceValues.map(entry => <div key={`${entry.field}:${entry.value}`}>{entry.label}: {entry.value}</div>)}
                            <Typography sx={{ mt: 1 }}>You may proceed. The next step will ask you to review and confirm these new values before the employee is added.</Typography>
                        </Alert>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenAddModal(false)}>Cancel</Button>
                    <Button onClick={requestAddEmployee} disabled={isSaving || Boolean(referenceError)}>Review and Submit</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openNewValueConfirmation} onClose={() => setOpenNewValueConfirmation(false)} fullWidth maxWidth="sm">
                <DialogTitle>Final Confirmation: New Information</DialogTitle>
                <DialogContent>
                    <Alert severity="error">The following values do not currently exist in the employee database. Confirm that they are intentionally new and correctly spelled.</Alert>
                    <List>{newReferenceValues.map(entry => <ListItem key={`${entry.field}:${entry.value}`}><ListItemText primary={entry.label} secondary={entry.value} /></ListItem>)}</List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenNewValueConfirmation(false)}>Go Back</Button>
                    <Button color="error" variant="contained" onClick={() => handleAddEmployeeSubmit(true)} disabled={isSaving}>{isSaving ? 'Adding…' : 'Confirm and Add Employee'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openDeleteModal} onClose={() => setOpenDeleteModal(false)} fullWidth maxWidth="sm">
                <DialogTitle>Delete Employee</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" name="firstName" label="First Name" fullWidth onChange={handleDeleteEmployeeChange} />
                    <TextField margin="dense" name="lastName" label="Last Name" fullWidth onChange={handleDeleteEmployeeChange} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeleteModal(false)}>Cancel</Button>
                    <Button onClick={handleDeleteEmployeeSubmit}>Delete</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default UtilitiesCenterComponent;
