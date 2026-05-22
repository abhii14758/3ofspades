
Invalid `prisma.user.findFirst()` invocation:
The table `public.User` does not exist in the current database.
[db] Attempt 14/15 failed: 
Invalid `prisma.user.findFirst()` invocation:
The table `public.User` does not exist in the current database.
prisma:error 
Invalid `prisma.user.findFirst()` invocation:
The table `public.User` does not exist in the current database.
[db] Attempt 15/15 failed: 
Invalid `prisma.user.findFirst()` invocation:
The table `public.User` does not exist in the current database.
[db] All connection attempts failed — starting without DB
> Ready on http://9dedecfbafbc:8080
> Socket.IO server running
prisma:error 
Invalid `prisma.roomDB.findMany()` invocation:
The table `public.RoomDB` does not exist in the current database.
      [cause]: [Object]
    }
  },
  clientVersion: '7.8.0'
}
[socket] Failed to recover rooms: Error [PrismaClientKnownRequestError]: 
Invalid `prisma.roomDB.findMany()` invocation:
The table `public.RoomDB` does not exist in the current database.
    at async loadAllActiveRooms (lib/db/roomPersistence.ts:188:19) {
  code: 'P2021',
  meta: {
    modelName: 'RoomDB',
    driverAdapterError: Error [DriverAdapterError]: TableDoesNotExist
        at ignore-listed frames {