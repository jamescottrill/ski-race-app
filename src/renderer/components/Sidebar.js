import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { List, ListItem, ListItemText, Collapse } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { Image } from '@mui/icons-material';

export default function Sidebar() {
  const { competitionId } = useParams(); // Get the current competitionId from the URL
  const [open, setOpen] = useState({
    competitors: false,
    races: false,
  });

  const handleClick = (section) => {
    setOpen((prevState) => ({ ...prevState, [section]: !prevState[section] }));
  };

  return (
    <div className="w-[250px] bg-blue-300 opacity-70" style={{ padding: '10px' }}>
      <ListItem component={Link} to={`/competition/${competitionId}`}>
      <img src={require('assets/img/logo.png')} alt="logo" className={"w-full p-2 pb-10"} />
      </ListItem>
      <List component="nav">
        {/* Competitors */}
        <ListItem onClick={() => handleClick('competitors')}>
          <ListItemText primary="Competitors" />
          {open.competitors ? <ExpandLess /> : <ExpandMore />}
        </ListItem>
        <Collapse in={open.competitors} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem
              component={Link}
              to={`/competition/${competitionId}/competitor/manage`}
            >
              <ListItemText primary="Manage" />
            </ListItem>
            <ListItem
              component={Link}
              to={`/competition/${competitionId}/competitor/list`}
            >
              <ListItemText primary="View Competitors" />
            </ListItem>
            <ListItem
              component={Link}
              to={`/competition/${competitionId}/competitor/new`}
            >
              <ListItemText primary="Register Competitor" />
            </ListItem>
            <ListItem
              component={Link}
              to={`/competition/${competitionId}/team/list`}
            >
              <ListItemText primary="View Teams" />
            </ListItem>
          </List>
        </Collapse>

        {/* Races */}
        <ListItem onClick={() => handleClick('races')}>
          <ListItemText primary="Races" />
          {open.races ? <ExpandLess /> : <ExpandMore />}
        </ListItem>
        <Collapse in={open.races} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem
              component={Link}
              to={`/competition/${competitionId}/race/new`}
            >
              <ListItemText primary="New Race" />
            </ListItem>
            <ListItem
              component={Link}
              to={`/competition/${competitionId}/race`}
            >
              <ListItemText primary="Manage Races" />
            </ListItem>
          </List>
        </Collapse>
      </List>
    </div>
  );
}
