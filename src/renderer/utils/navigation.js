import { useNavigate } from 'react-router-dom';

export const useBackButton = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1); // Navigate back to the previous page
  };

  return handleBack;
};
