import React from 'react';
import {
  Scheduler,
  WeekView,
  MonthView,
  DayView,
  Appointments,
  Toolbar,
  DateNavigator,
  ViewSwitcher,
} from '@devexpress/dx-react-scheduler-material-ui';
import { ViewState } from '@devexpress/dx-react-scheduler';
import { AppointmentTooltip } from '@devexpress/dx-react-scheduler-material-ui';

function CalendarComponent() {
  const currentDate = '2024-04-15'; // Example date
  const schedulerData = [
    {
      startDate: '2024-04-15T09:45',
      endDate: '2024-04-15T11:00',
      title: 'Meeting',
      creator: 'Alice Johnson',
      location: 'Conference Room A'
    },
    {
      startDate: '2024-04-15T12:00',
      endDate: '2024-04-15T13:30',
      title: 'Lunch with Investors',
      creator: 'Bob Smith',
      location: 'Restaurant B'
    },
    // Add more events as needed
  ];

  const Appointment = ({ children, data, ...restProps }) => (
    <Appointments.Appointment {...restProps}>
      <div>
        {children}
        <div style={{ marginTop: '5px', fontSize: 'small', color: '#888' }}>
          <strong>{data.creator}</strong> - {data.location}
        </div>
      </div>
    </Appointments.Appointment>
  );

  const TooltipContent = ({ appointmentData, ...restProps }) => (
    <AppointmentTooltip.Content {...restProps} appointmentData={appointmentData}>
      <div style={{ marginTop: '10px' }}>
        <div>
          <strong>Location:</strong> {appointmentData.location}
        </div>
        <div>
          <strong>Created by:</strong> {appointmentData.creator}
        </div>
      </div>
    </AppointmentTooltip.Content>
  );

  return (
    <Scheduler
      data={schedulerData}
      locale="en-US"
    >
      <ViewState
        currentDate={currentDate}
      />
      <MonthView />
      <WeekView
        startDayHour={8}
        endDayHour={20}
      />
      <DayView 
        startDayHour={8}
        endDayHour={20}
      />
      <Toolbar />
      <DateNavigator />
      <ViewSwitcher />
      <Appointments />
      <AppointmentTooltip contentComponent={TooltipContent} showCloseButton showOpenButton />

    </Scheduler>
  );
}

export default CalendarComponent;