import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from '../design-system';
import { TextField, SimpleSelect, Button } from '../design-system';
import { v4 as uuid4 } from 'uuid';

const initialFormValues = {
  firstName: '',
  lastName: '',
  title: '',
  birthYear: '',
  country: 'GBR',
  gender: 'M',
};

export default function PersonModalNew({ open, onClose, onSave }) {
  const [formData, setFormData] = useState(initialFormValues);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName || !formData.lastName) {
      setError('First name and last name are required');
      return;
    }

    const id = uuid4();

    const query = `
      INSERT INTO people (id, first_name, last_name, title, birth_year, country, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      id,
      formData.firstName,
      formData.lastName,
      formData.title || null,
      formData.birthYear || null,
      formData.country,
      formData.gender,
    ];

    try {
      await window.api.insert(query, params);
      const newPerson = {
        id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        title: formData.title,
      };
      onSave(newPerson);
      setFormData(initialFormValues);
      onClose();
    } catch (err) {
      console.error('Failed to add person:', err);
      setError('Failed to add person. Please try again.');
    }
  };

  const handleClose = () => {
    setFormData(initialFormValues);
    setError('');
    onClose();
  };

  return (
    <Modal open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <ModalContent size="md">
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            <ModalTitle>Add New Person</ModalTitle>
          </ModalHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded text-danger text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
              <TextField
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>

            <TextField
              label="Title/Rank"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Maj, Capt, WO1"
            />

            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Birth Year"
                name="birthYear"
                type="number"
                value={formData.birthYear}
                onChange={handleChange}
                placeholder="e.g., 1985"
              />
              <SimpleSelect
                label="Gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </SimpleSelect>
            </div>

            <TextField
              label="Country"
              name="country"
              value={formData.country}
              onChange={handleChange}
            />
          </div>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add Person
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
