const round = (int) =>{
  if(typeof int !== 'number'){
    return null;
  }
  return Math.round(int * 100 + Number.EPSILON)/100;
};

export {round};
