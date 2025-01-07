const round = (int) =>{
  return Math.round(int * 100 + Number.EPSILON)/100;
};

export {round};
