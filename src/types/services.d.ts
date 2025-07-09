type ServicesItem = {
  url: string;
  name: string;
  description: string;
};

type ServicesGroup = {
  name: string;
};

type ServicesState = {
  personal: string;
  favourites: {} | ServicesItem;
  list: ServicesItem[] | ServicesGroup[];
};
