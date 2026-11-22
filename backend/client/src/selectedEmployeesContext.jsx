import React, { createContext, useState } from 'react';

export const SelectedEmployeesContext = createContext({
  selectedEmployees: [],
  setSelectedEmployees: () => {},
});

export const SelectedEmployeesProvider = ({ children }) => {
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  return (
    <SelectedEmployeesContext.Provider value={{ selectedEmployees, setSelectedEmployees }}>
      {children}
    </SelectedEmployeesContext.Provider>
  );
};
