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
} from '@mui/material';

function EmployeeSelectionComponent() {
    const { selectedEmployees, setSelectedEmployees } = useContext(SelectedEmployeesContext);
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [filterValues, setFilterValues] = useState({});
    const [selectedFilters, setSelectedFilters] = useState({});
    const [startDate, setStartDate] = useState('1980-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [deselectedEmployees, setDeselectedEmployees] = useState(new Set());

    useEffect(() => {
        applyFilters();
    }, [selectedFilters, employees, deselectedEmployees, startDate, endDate]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const loginName = JSON.parse(localStorage.getItem('loginName'));
                const response = await axios.get(`/employees?lastName=${loginName.lastName}&firstName=${loginName.firstName}`);
                console.log(response);
                const processedData = response.data.map(employee => ({
                    ...employee,
                    'Name': `${employee['Last Name']}, ${employee['First Name']}`,
                    'Supervisor': `${employee['Supervisor Last Name']}, ${employee['Supervisor First Name']}`
                }));
                const sortedData = processedData.sort((a, b) => {
                    return a['Last Name'].localeCompare(b['Last Name']);
                });
                console.log(sortedData);
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
        console.log(finalFilteredEmployees);
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
            <TableContainer component={Paper}>
                <Table aria-label="employee selection table">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell
                                    key={column.id}
                                    style={{ fontWeight: 'bold' }} // Apply bold styling to the column names
                                >
                                    {column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
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
                                    ) : column.id === 'Hire Date' ? (
                                        null
                                    ) : null}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredEmployees.map((employee) => (
                            <TableRow key={employee._id} style={{ textDecoration: deselectedEmployees.has(employee._id) ? 'line-through' : 'none' }}>
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
        </div>
    );
}

export default EmployeeSelectionComponent;
