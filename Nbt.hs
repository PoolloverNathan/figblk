import Data.Int

data NbtType where
    NbtEnd       :: NbtType
    NbtByte      :: NbtType
    NbtShort     :: NbtType
    NbtInt       :: NbtType
    NbtLong      :: NbtType
    NbtFloat     :: NbtType
    NbtDouble    :: NbtType
    NbtByteArray :: NbtType
    NbtString    :: NbtType
    NbtList      :: NbtType
    NbtCompound  :: NbtType
    NbtIntArray  :: NbtType
    NbtLongArray :: NbtType
    deriving (Eq, Enum)
data NbtValue where
    NbtByte'      :: Int8                 -> NbtValue
    NbtShort'     :: Int16                -> NbtValue
    NbtInt'       :: Int32                -> NbtValue
    NbtLong'      :: Int64                -> NbtValue
    NbtFloat'     :: Float                -> NbtValue
    NbtDouble'    :: Double               -> NbtValue
    NbtByteArray' :: [Int8]               -> NbtValue
    NbtString'    :: [Char]               -> NbtValue
    NbtList'      :: [NbtValue]           -> NbtValue
    NbtCompound'  :: [(String, NbtValue)] -> NbtValue
    NbtIntArray'  :: [Int32]              -> NbtValue
    NbtLongArray' :: [Int16]              -> NbtValue
unNbtByte      :: NbtValue -> Int8
unNbtByte       (NbtByte'      x) = x
unNbtShort     :: NbtValue -> Int16
unNbtShort      (NbtShort'     x) = x
unNbtInt       :: NbtValue -> Int32
unNbtInt        (NbtInt'       x) = x
unNbtLong      :: NbtValue -> Int64
unNbtLong       (NbtLong'      x) = x
unNbtFloat     :: NbtValue -> Float
unNbtFloat      (NbtFloat'     x) = x
unNbtDouble    :: NbtValue -> Double
unNbtDouble     (NbtDouble'    x) = x
unNbtByteArray :: NbtValue -> [Int8]
unNbtByteArray  (NbtByteArray' x) = x
unNbtString    :: NbtValue -> [Char]
unNbtString     (NbtString'    x) = x
unNbtList      :: NbtValue -> [NbtValue]
unNbtList       (NbtList'      x) = x
unNbtCompound  :: NbtValue -> [(String, NbtValue)]
unNbtCompound   (NbtCompound'  x) = x
unNbtIntArray  :: NbtValue -> [Int32]
unNbtIntArray   (NbtIntArray'  x) = x
unNbtLongArray :: NbtValue -> [Int16]
unNbtLongArray  (NbtLongArray' x) = x
nbtTypeOf :: NbtValue -> NbtType
nbtTypeOf (NbtByte'      _) = NbtByte
nbtTypeOf (NbtShort'     _) = NbtShort
nbtTypeOf (NbtInt'       _) = NbtInt
nbtTypeOf (NbtLong'      _) = NbtLong
nbtTypeOf (NbtFloat'     _) = NbtFloat
nbtTypeOf (NbtDouble'    _) = NbtDouble
nbtTypeOf (NbtByteArray' _) = NbtByteArray
nbtTypeOf (NbtString'    _) = NbtString
nbtTypeOf (NbtList'      _) = NbtList
nbtTypeOf (NbtCompound'  _) = NbtCompound
nbtTypeOf (NbtIntArray'  _) = NbtIntArray
nbtTypeOf (NbtLongArray' _) = NbtLongArray
nbtRead NbtByte      b = (NbtByte' $ head b, tail b)
nbtRead NbtShort     b = ()
nbtRead NbtInt       b = ()
nbtRead NbtLong      b = ()
nbtRead NbtFloat     b = ()
nbtRead NbtDouble    b = ()
nbtRead NbtByteArray b = ()
nbtRead NbtString    b = ()
nbtRead NbtList      b = ()
nbtRead NbtCompound  b = ()
nbtRead NbtIntArray  b = ()
nbtRead NbtLongArray b = ()