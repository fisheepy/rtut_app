import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { SelectedEmployeesContext } from './selectedEmployeesContext';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Checkbox,
    Paper,
    TextField,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Grid,
} from '@mui/material';

function EmployeeSelectionComponent() {
    const { selectedEmployees, setSelectedEmployees } = useContext(SelectedEmployeesContext);
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [filterValues, setFilterValues] = useState({});
    const [selectedFilters, setSelectedFilters] = useState({ isActivated: ['true'] }); // Default to "true" for "Activated"
    const [startDate, setStartDate] = useState('1980-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [deselectedEmployees, setDeselectedEmployees] = useState(new Set());
    const [selectAllChecked, setSelectAllChecked] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    useEffect(() => {
        applyFilters();
    }, [selectedFilters, employees, deselectedEmployees, startDate, endDate]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const loginName = JSON.parse(localStorage.getItem('loginName'));
                const response = await axios.get(`/employees?lastName=${loginName.lastName}&firstName=${loginName.firstName}`);
                const processedData = response.data.map(employee => ({
                    ...employee,
                    'Name': `${employee['Last Name']}, ${employee['First Name']}`,
                    'Supervisor': `${employee['Supervisor Last Name']}, ${employee['Supervisor First Name']}`
                }));
                const sortedData = processedData.sort((a, b) => a['Last Name'].localeCompare(b['Last Name']));
                setEmployees(sortedData);
                setFilteredEmployees(sortedData);
                extractFilterValues(sortedData);
                setSelectedEmployees(sortedData);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, []);

    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
    };

    const extractFilterValues = (data) => {
        const values = {};
        if (data.length > 0) {
            for (const column of Object.keys(data[0])) {
                const uniqueValues = [...new Set(data.map((item) => item[column]))];
                values[column] = uniqueValues;
            }
            setFilterValues(values);
        }
    };

    const handleFilterChange = (event, columnName) => {
        const value = event.target.value;
        setSelectedFilters(prevFilters => {
            if (value === "") {
                const newFilters = { ...prevFilters };
                delete newFilters[columnName];
                return newFilters;
            } else {
                return {
                    ...prevFilters,
                    [columnName]: value,
                };
            }
        });
        applyFilters();
    };

    const applyFilters = () => {
        const payrollNameFilter = selectedFilters['Name'];
        const defaultStartDate = new Date('1995/01/01');
        const defaultEndDate = new Date();
        const start = startDate ? new Date(startDate) : defaultStartDate;
        const end = endDate ? new Date(endDate) : defaultEndDate;

        const filteredByPayrollName = payrollNameFilter && payrollNameFilter.length > 0
            ? employees.filter(employee => payrollNameFilter.includes(employee['Name']))
            : [];

        const filteredByOtherCriteria = employees.filter(employee => {
            const hireDate = new Date(employee['Hire Date']);
            const isInDateRange = hireDate >= start && hireDate <= end;
            const matchesOtherFilters = Object.entries(selectedFilters).every(([columnName, filterValues]) =>
                columnName === 'Name' ||
                filterValues.length === 0 || filterValues.includes(employee[columnName])
            );

            return isInDateRange && matchesOtherFilters;
        });

        const combinedFilteredEmployees = [
            ...filteredByPayrollName,
            ...filteredByOtherCriteria.filter(employee =>
                !filteredByPayrollName.some(filteredEmployee => filteredEmployee['Name'] === employee['Name'])
            )
        ];
        const finalFilteredEmployees = combinedFilteredEmployees.filter(employee =>
            !deselectedEmployees.has(employee._id)
        );

        setFilteredEmployees(combinedFilteredEmployees);
        setSelectedEmployees(finalFilteredEmployees);
    };

    const handleCheckboxChange = (employeeId) => {
        setDeselectedEmployees(prev => {
            const newSet = new Set(prev);
            if (newSet.has(employeeId)) {
                newSet.delete(employeeId);
            } else {
                newSet.add(employeeId);
            }
            return newSet;
        });
    };

    const handleSelectAllChange = () => {
        setSelectAllChecked(!selectAllChecked);
        if (!selectAllChecked) {
            setDeselectedEmployees(new Set());
        } else {
            const allEmployeeIds = new Set(filteredEmployees.map(emp => emp._id));
            setDeselectedEmployees(allEmployeeIds);
        }
    };

    const handleRowDoubleClick = (employee) => {
        setSelectedEmployee(employee);
        setIsEditModalOpen(true);
    };

    const handleModalClose = () => {
        setIsEditModalOpen(false);
        setSelectedEmployee(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSelectedEmployee(prevEmployee => ({
            ...prevEmployee,
            [name]: value,
        }));
    };

    const handleSaveChanges = async () => {
        try {
            await axios.put(`/employees/${selectedEmployee._id}`, selectedEmployee);
            setEmployees((prevEmployees) => prevEmployees.map((emp) => (emp._id === selectedEmployee._id ? selectedEmployee : emp)));
            applyFilters();
            handleModalClose();
        } catch (error) {
            console.error('Error updating employee:', error);
        }
    };

    const columns = [
        { id: 'Hire Date', label: 'Hire Date', filter: false },
        { id: 'Name', label: 'Name (Override Add)', filter: true },
        { id: 'Position Status', label: 'Position Status', filter: true },
        { id: 'Home Department', label: 'Home Department', filter: true },
        { id: 'Job Title', label: 'Job Title', filter: true },
        { id: 'Location', label: 'Location', filter: true },
        { id: 'Supervisor', label: 'Supervisor', filter: true },
        { id: 'Phone', label: 'Phone', filter: true },
        { id: 'Email', label: 'Email', filter: true },
        { id: 'Worker Category', label: 'Employment', filter: true },
        { id: 'Pay Category', label: 'Pay', filter: true },
        { id: 'EEOC Establishment', label: 'EEOC', filter: true },
        { id: 'isActivated', label: 'Activated', filter: true },
        { id: 'select', label: '(Override Remove)', filter: false },
    ];

    return (
        <div>
            <h3>Selected Employees</h3>
            <TableContainer component={Paper} style={{ maxHeight: 600 }}>
                <Table aria-label="employee selection table" stickyHeader>
                    <TableHead>
                        <TableRow style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'white' }}>
                            {columns.map((column) => (
                                <TableCell
                                    key={column.id}
                                    style={{ fontWeight: 'bold', backgroundColor: 'white' }}
                                >
                                    {column.id === 'select' ? (
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <Checkbox
                                                checked={selectAllChecked}
                                                onChange={handleSelectAllChange}
                                                color="primary"
                                            />
                                            <span>(Override Remove)</span>
                                        </div>
                                    ) : column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow style={{ position: 'sticky', top: 48, zIndex: 1, backgroundColor: 'white' }}>
                            {columns.slice(0, columns.findIndex(col => col.id === 'Hire Date')).map(col => (
                                <TableCell key={col.id} />
                            ))}
                            <TableCell colSpan={1}>
                                <TextField
                                    id="start-date"
                                    label="Start Date"
                                    type="date"
                                    value={startDate}
                                    onChange={handleStartDateChange}
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                    variant="outlined"
                                    size="small"
                                />
                                <TextField
                                    id="end-date"
                                    label="End Date"
                                    type="date"
                                    value={endDate}
                                    onChange={handleEndDateChange}
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                    variant="outlined"
                                    size="small"
                                />
                            </TableCell>
                            {columns.slice(columns.findIndex(col => col.id === 'Hire Date') + 1).map(column => (
                                <TableCell key={column.id + '-filter'}>
                                    {column.filter ? (
                                        <TextField
                                            select
                                            SelectProps={{
                                                multiple: true,
                                                renderValue: (selected) => selected.join(', '),
                                            }}
                                            fullWidth
                                            label={column.label}
                                            value={selectedFilters[column.id] || []}
                                            onChange={(e) => handleFilterChange(e, column.id)}
                                            size="small"
                                        >
                                            {filterValues[column.id]?.map(option => (
                                                <MenuItem key={option} value={option}>
                                                    <Checkbox checked={selectedFilters[column.id]?.includes(option) || false} />
                                                    {option}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    ) : column.id === 'Hire Date' ? null : null}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {filteredEmployees.map((employee) => (
                            <TableRow
                                key={employee._id}
                                onDoubleClick={() => handleRowDoubleClick(employee)}
                                style={{ textDecoration: deselectedEmployees.has(employee._id) ? 'line-through' : 'none' }}
                            >
                                {columns.map((column) => (
                                    <TableCell key={column.id}>
                                        {column.id === 'select' ? (
                                            <Checkbox
                                                checked={!deselectedEmployees.has(employee._id)}
                                                onChange={() => handleCheckboxChange(employee._id)}
                                                color="primary"
                                            />
                                        ) : (
                                            employee[column.id] || ''
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={isEditModalOpen} onClose={handleModalClose} maxWidth="md" fullWidth>
                <DialogTitle>Edit Employee Information</DialogTitle>
                <DialogContent>
                    {selectedEmployee && (
                        <Grid container spacing={2}>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="First Name"
                                    name="First Name"
                                    value={selectedEmployee['First Name']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Last Name"
                                    name="Last Name"
                                    value={selectedEmployee['Last Name']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Hire Date"
                                    name="Hire Date"
                                    type="date"
                                    value={selectedEmployee['Hire Date']}
                                    onChange={handleInputChange}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Home Department"
                                    name="Home Department"
                                    value={selectedEmployee['Home Department']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Supervisor First Name"
                                    name="Supervisor First Name"
                                    value={selectedEmployee['Supervisor First Name']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Supervisor Last Name"
                                    name="Supervisor Last Name"
                                    value={selectedEmployee['Supervisor Last Name']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Job Title"
                                    name="Job Title"
                                    value={selectedEmployee['Job Title']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Location"
                                    name="Location"
                                    value={selectedEmployee['Location']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Email"
                                    name="Email"
                                    value={selectedEmployee['Email']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Phone"
                                    name="Phone"
                                    value={selectedEmployee['Phone']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="EEOC Establishment"
                                    name="EEOC Establishment"
                                    value={selectedEmployee['EEOC Establishment']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Employment Category"
                                    name="Worker Category"
                                    value={selectedEmployee['Worker Category']}
                                    onChange={handleInputChange}
                                />
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleModalClose}>Cancel</Button>
                    <Button onClick={handleSaveChanges} color="primary">Save</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

export default EmployeeSelectionComponent;
